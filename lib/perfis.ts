/**
 * Perfis de jogador — fábrica (código) + DINÂMICOS criados pela interface
 * (SPEC-perfis-pela-interface v1.1).
 *
 * Regras que vieram do juiz da SPEC:
 * - As CHAVES de memória derivam de `idJogadorSalvo()` (string síncrona do
 *   localStorage, SEM validar contra o catálogo) — um jogo aberto por link
 *   direto com jogador dinâmico e IDB lento jamais lê/grava na Manuela (B2).
 * - O catálogo dinâmico carrega do IndexedDB (loja `perfis`, schema em
 *   lib/bd.ts — dono único, B3) com estados carregando→pronto; o véu do hub
 *   só sai após a validação (GradeJogos).
 * - Blob URLs têm ciclo de vida contratado (B1): cache por id+atualizadoEm,
 *   create fora de render, revoke SÓ após replace/delete assentar.
 * - Id é IMUTÁVEL após criação; apagar SEMPRE apaga os salvamentos (B8);
 *   criação é transacional com `add` + limite (B9).
 */

import { LOJAS_JOGOS, LOJA_ATELIE, LOJA_PERFIS, abrirBd, bdSuportado } from "./bd";
import { IDENTIDADE, criarIdentidade, type Identidade } from "./identidade";

export interface FiguraPerfil {
  src: string;
  largura: number;
  altura: number;
}

export interface Perfil {
  id: string;
  identidade: Identidade;
  corpo: FiguraPerfil;
  avatar: FiguraPerfil;
  /** Cor do card na tela de escolha (classe ring-* completa, nunca montada). */
  anel: string;
  dinamico?: boolean;
}

export interface PerfilDinamicoRegistro {
  id: string;
  nome: string;
  apelido: string;
  genero: "a" | "o";
  anel: string;
  corpo: Blob;
  corpoLargura: number;
  corpoAltura: number;
  avatar: Blob;
  criadoEm: number;
  atualizadoEm: number;
}

export const PERFIS: readonly Perfil[] = [
  {
    id: "manuela",
    identidade: IDENTIDADE,
    corpo: { src: "/manu/manu-corpo.webp", largura: 642, altura: 1244 },
    avatar: { src: "/manu/manu-avatar.webp", largura: 512, altura: 512 },
    anel: "ring-manu-rosa",
  },
  {
    id: "leo",
    identidade: criarIdentidade({ nome: "Leo", apelido: "Leo", genero: "o" }),
    corpo: { src: "/leo/leo-corpo.webp", largura: 808, altura: 1147 },
    avatar: { src: "/leo/leo-avatar.webp", largura: 512, altura: 512 },
    anel: "ring-manu-ceu",
  },
  {
    id: "gustavo",
    identidade: criarIdentidade({ nome: "Gustavo", apelido: "Gustavo", genero: "o" }),
    corpo: { src: "/gustavo/gustavo-corpo.webp", largura: 541, altura: 1426 },
    avatar: { src: "/gustavo/gustavo-avatar.webp", largura: 512, altura: 512 },
    anel: "ring-manu-ceu",
  },
];

export const MAXIMO_DINAMICOS = 5;
export const IDS_RESERVADOS = new Set(["manuela", "leo", "gustavo", "novo"]);

/** Exportada para o script anti-FOUC do hub (o literal vive só aqui). */
export const CHAVE_JOGADOR = "manu:jogador";
const PERFIL_LEGADO = PERFIS[0];

// ─── escolha do jogador (localStorage, síncrona) ───────────────────────────

let cacheJogador: string | null | undefined; // undefined = ainda não lido
const ouvintes = new Set<() => void>();

function avisar(): void {
  for (const cb of ouvintes) cb();
}

/**
 * ID salvo, CRU (sem validar contra o catálogo): é dele que as chaves de
 * memória derivam — válido mesmo antes do catálogo dinâmico carregar.
 * Sem escolha salva, o dono é o perfil legado (comportamento pré-perfis).
 */
export function idJogadorSalvo(): string {
  if (typeof localStorage === "undefined") return PERFIL_LEGADO.id;
  if (cacheJogador === undefined) {
    try {
      cacheJogador = localStorage.getItem(CHAVE_JOGADOR);
    } catch {
      cacheJogador = null;
    }
  }
  return cacheJogador ?? PERFIL_LEGADO.id;
}

/**
 * Id do jogador escolhido para a UI: null = mostrar a tela de escolha.
 * Enquanto o catálogo carrega, um id salvo é aceito provisoriamente (evita
 * flash do picker para dinâmicos); id inválido cai para null quando "pronto".
 */
export function lerJogador(): string | null {
  if (typeof localStorage === "undefined") return null;
  idJogadorSalvo();
  if (cacheJogador == null) return null;
  if (listaMesclada.some((p) => p.id === cacheJogador)) return cacheJogador;
  return estadoRegistro === "pronto" ? null : cacheJogador;
}

export function salvarJogador(id: string): void {
  if (!listaMesclada.some((p) => p.id === id)) return;
  cacheJogador = id;
  avisar();
  try {
    localStorage.setItem(CHAVE_JOGADOR, id);
  } catch {
    // sem persistência a escolha vale só para a sessão
  }
}

/** Volta para a tela de escolha (botão "trocar jogador"). */
export function limparJogador(): void {
  cacheJogador = null;
  avisar();
  try {
    localStorage.removeItem(CHAVE_JOGADOR);
  } catch {
    // idem
  }
}

export function assinarJogador(cb: () => void): () => void {
  ouvintes.add(cb);
  return () => ouvintes.delete(cb);
}

/** No servidor sempre há jogador (o hub SSR é o caso comum pós-escolha). */
export function jogadorNoServidor(): string | null {
  return PERFIS[0].id;
}

// ─── catálogo dinâmico (IndexedDB) ────────────────────────────────────────

type EstadoRegistro = "carregando" | "pronto";
let estadoRegistro: EstadoRegistro = "carregando";
let listaMesclada: Perfil[] = [...PERFIS]; // snapshot ESTÁVEL p/ useSyncExternalStore

// contrato de blob URLs (juiz B1): cache por id, invalidação por atualizadoEm
const urls = new Map<string, { atualizadoEm: number; corpo: string; avatar: string }>();

function urlsDoRegistro(r: PerfilDinamicoRegistro): { corpo: string; avatar: string } {
  const atual = urls.get(r.id);
  if (atual && atual.atualizadoEm === r.atualizadoEm) return atual;
  const novo = {
    atualizadoEm: r.atualizadoEm,
    corpo: URL.createObjectURL(r.corpo),
    avatar: URL.createObjectURL(r.avatar),
  };
  urls.set(r.id, novo);
  if (atual) revogarDepois.push(atual.corpo, atual.avatar);
  return novo;
}

// URLs antigas aguardam o snapshot novo assentar; um <img> JÁ carregado não
// perde o conteúdo no revoke — o prazo protege carregamentos em andamento
const revogarDepois: string[] = [];

function drenarRevogacoes(): void {
  const pendentes = revogarDepois.splice(0);
  if (pendentes.length === 0) return;
  setTimeout(() => {
    for (const url of pendentes) URL.revokeObjectURL(url);
  }, 3000);
}

function revogarUrls(id: string): void {
  const atual = urls.get(id);
  if (!atual) return;
  urls.delete(id);
  revogarDepois.push(atual.corpo, atual.avatar);
  drenarRevogacoes();
}

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", () => {
    for (const { corpo, avatar } of urls.values()) {
      URL.revokeObjectURL(corpo);
      URL.revokeObjectURL(avatar);
    }
    urls.clear();
  });
}

function registroValido(r: unknown): r is PerfilDinamicoRegistro {
  const x = r as PerfilDinamicoRegistro;
  return (
    typeof x?.id === "string" &&
    typeof x.nome === "string" &&
    typeof x.apelido === "string" &&
    (x.genero === "a" || x.genero === "o") &&
    typeof x.anel === "string" &&
    x.corpo instanceof Blob &&
    x.avatar instanceof Blob &&
    typeof x.corpoLargura === "number" &&
    typeof x.corpoAltura === "number"
  );
}

function paraPerfil(r: PerfilDinamicoRegistro): Perfil | null {
  try {
    // identidade primeiro: registro inválido não deve nem criar blob URLs
    const identidade = criarIdentidade({ nome: r.nome, apelido: r.apelido, genero: r.genero });
    const u = urlsDoRegistro(r);
    return {
      id: r.id,
      identidade,
      corpo: { src: u.corpo, largura: r.corpoLargura, altura: r.corpoAltura },
      avatar: { src: u.avatar, largura: 512, altura: 512 },
      anel: r.anel,
      dinamico: true,
    };
  } catch (erro) {
    console.warn(`perfil dinâmico corrompido ignorado: ${r.id}`, erro);
    return null; // pular, nunca derrubar o catálogo
  }
}

async function lerDinamicos(): Promise<PerfilDinamicoRegistro[]> {
  if (!bdSuportado()) return [];
  const bd = await abrirBd();
  return await new Promise((resolve, reject) => {
    const tx = bd.transaction(LOJA_PERFIS, "readonly");
    const pedido = tx.objectStore(LOJA_PERFIS).getAll();
    pedido.onsuccess = () => resolve(pedido.result as PerfilDinamicoRegistro[]);
    pedido.onerror = () => reject(pedido.error);
    tx.oncomplete = () => bd.close();
    tx.onabort = () => {
      bd.close();
      reject(tx.error);
    };
  });
}

/** (Re)carrega os dinâmicos; idempotente; notifica assinantes. */
export async function carregarPerfis(): Promise<void> {
  let dinamicos: Perfil[] = [];
  try {
    dinamicos = (await lerDinamicos())
      .filter(registroValido)
      .sort((a, b) => a.criadoEm - b.criadoEm)
      .map(paraPerfil)
      .filter((p): p is Perfil => p !== null);
  } catch {
    dinamicos = [];
  }
  estadoRegistro = "pronto";
  listaMesclada = [...PERFIS, ...dinamicos];
  avisar();
  drenarRevogacoes(); // replaces desta carga: revogar só APÓS o snapshot novo
}

export function registroPronto(): boolean {
  return estadoRegistro === "pronto";
}

/** Fábrica + dinâmicos (snapshot estável até a próxima notificação). */
export function listarPerfis(): Perfil[] {
  return listaMesclada;
}

/** Perfil ativo para UI (exige catálogo); para CHAVES use idJogadorSalvo(). */
export function perfilAtivo(): Perfil {
  const id = idJogadorSalvo();
  return listaMesclada.find((p) => p.id === id) ?? PERFIL_LEGADO;
}

export function perfilNoServidor(): Perfil {
  return PERFIS[0];
}

// ─── CRUD dinâmico (SPEC §2) ──────────────────────────────────────────────

function slugDe(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export interface DadosNovoPerfil {
  nome: string;
  apelido: string;
  genero: "a" | "o";
  corpo: Blob;
  corpoLargura: number;
  corpoAltura: number;
  avatar: Blob;
}

export function anelPorGenero(genero: "a" | "o"): string {
  return genero === "a" ? "ring-manu-rosa" : "ring-manu-ceu";
}

/** Aloca id único e IMUTÁVEL a partir do apelido (pura — unit-testável).
 *  Base vazia ou com prefixo perigoso vira "jogador" ANTES do loop — sufixar
 *  "progresso" jamais escaparia do prefixo (loop infinito pego pelo unit). */
export function alocarId(base: string, existentes: ReadonlySet<string>): string {
  const baseSegura = base === "" || /^(progresso|rascunho)/.test(base) ? "jogador" : base;
  let id = baseSegura;
  for (let n = 2; IDS_RESERVADOS.has(id) || existentes.has(id); n++) {
    id = `${baseSegura}-${n}`;
  }
  return id;
}

/** count + slug + add numa ÚNICA transação (juiz B9). Lança em limite/validação. */
export async function criarPerfilDinamico(dados: DadosNovoPerfil): Promise<string> {
  const apelido = dados.apelido.trim() || dados.nome.trim().split(/\s+/)[0];
  // valida ANTES de abrir transação (criarIdentidade lança se inválido)
  criarIdentidade({ nome: dados.nome, apelido, genero: dados.genero });
  const base = slugDe(apelido);
  const bd = await abrirBd();
  const id = await new Promise<string>((resolve, reject) => {
    let escolhido = "";
    const tx = bd.transaction(LOJA_PERFIS, "readwrite");
    const loja = tx.objectStore(LOJA_PERFIS);
    const contagem = loja.count();
    contagem.onsuccess = () => {
      if (contagem.result >= MAXIMO_DINAMICOS) {
        tx.abort();
        return;
      }
      const chaves = loja.getAllKeys();
      chaves.onsuccess = () => {
        const existentes = new Set(chaves.result as string[]);
        escolhido = alocarId(base, existentes);
        const agora = Date.now();
        loja.add({
          id: escolhido,
          nome: dados.nome.trim(),
          apelido,
          genero: dados.genero,
          anel: anelPorGenero(dados.genero),
          corpo: dados.corpo,
          corpoLargura: dados.corpoLargura,
          corpoAltura: dados.corpoAltura,
          avatar: dados.avatar,
          criadoEm: agora,
          atualizadoEm: agora,
        } satisfies PerfilDinamicoRegistro); // add, não put: colisão aborta
      };
    };
    tx.oncomplete = () => {
      bd.close();
      resolve(escolhido);
    };
    tx.onerror = () => {
      bd.close();
      reject(tx.error ?? new Error("não deu para criar o perfil"));
    };
    tx.onabort = () => {
      bd.close();
      reject(new Error("limite de perfis atingido"));
    };
  });
  await carregarPerfis();
  return id;
}

/** Edição NUNCA muda o id (juiz B8). Campos de imagem são opcionais. */
export async function editarPerfilDinamico(
  id: string,
  mudancas: Partial<DadosNovoPerfil>,
): Promise<void> {
  const bd = await abrirBd();
  await new Promise<void>((resolve, reject) => {
    const tx = bd.transaction(LOJA_PERFIS, "readwrite");
    const loja = tx.objectStore(LOJA_PERFIS);
    const leitura = loja.get(id);
    leitura.onsuccess = () => {
      const atual = leitura.result as PerfilDinamicoRegistro | undefined;
      if (!atual) {
        tx.abort();
        return;
      }
      const genero = mudancas.genero ?? atual.genero;
      try {
        // review PR #52: edição sem validar gravava registro que o catálogo
        // depois descartava — o perfil "sumia" com o dado corrompido no banco
        criarIdentidade({
          nome: mudancas.nome?.trim() || atual.nome,
          apelido: mudancas.apelido?.trim() || atual.apelido,
          genero,
        });
      } catch {
        tx.abort();
        return;
      }
      loja.put({
        ...atual,
        nome: mudancas.nome?.trim() || atual.nome,
        apelido: mudancas.apelido?.trim() || atual.apelido,
        genero,
        anel: anelPorGenero(genero),
        corpo: mudancas.corpo ?? atual.corpo,
        corpoLargura: mudancas.corpoLargura ?? atual.corpoLargura,
        corpoAltura: mudancas.corpoAltura ?? atual.corpoAltura,
        avatar: mudancas.avatar ?? atual.avatar,
        atualizadoEm: Date.now(),
      } satisfies PerfilDinamicoRegistro);
    };
    tx.oncomplete = () => {
      bd.close();
      resolve();
    };
    tx.onerror = () => {
      bd.close();
      reject(tx.error);
    };
    tx.onabort = () => {
      bd.close();
      reject(new Error("perfil não encontrado"));
    };
  });
  await carregarPerfis();
}

/**
 * Apagar SEMPRE apaga os salvamentos (juiz B8), numa ÚNICA transação:
 * perfil + progresso nas 18 lojas + desenhos/rascunho do ateliê. Depois:
 * chave de config e, se era o ativo, a escolha.
 */
export async function apagarPerfilDinamico(id: string): Promise<void> {
  const bd = await abrirBd();
  await new Promise<void>((resolve, reject) => {
    const lojas = [LOJA_PERFIS, LOJA_ATELIE, ...LOJAS_JOGOS];
    const tx = bd.transaction(lojas, "readwrite");
    const perfis = tx.objectStore(LOJA_PERFIS);
    const confirmacao = perfis.get(id);
    confirmacao.onsuccess = () => {
      if (!confirmacao.result) {
        // id de fábrica ou inexistente: NUNCA varrer (review PR #52 — apagar
        // "manuela" aqui destruía os dados dela sem existir na loja)
        tx.abort();
        return;
      }
      executarVarredura();
    };
    const executarVarredura = () => {
    perfis.delete(id);
    for (const jogo of LOJAS_JOGOS) {
      tx.objectStore(jogo).delete(`progresso:${id}`);
    }
    const atelie = tx.objectStore(LOJA_ATELIE);
    atelie.delete(`rascunho:${id}`);
    const varredura = atelie.getAll();
    varredura.onsuccess = () => {
      for (const registro of varredura.result as Array<{ id: string; perfil?: string }>) {
        if (registro.perfil === id) atelie.delete(registro.id);
      }
    };
    };
    tx.oncomplete = () => {
      bd.close();
      resolve();
    };
    tx.onerror = () => {
      bd.close();
      reject(tx.error);
    };
    tx.onabort = () => {
      bd.close();
      reject(new Error("só perfis criados na interface podem ser apagados"));
    };
  });
  try {
    localStorage.removeItem(`manu-jogos-ocultos:${id}`);
  } catch {
    // sem storage: nada a limpar
  }
  for (const cb of aoApagarPerfil) cb(id);
  if (idJogadorSalvo() === id) limparJogador();
  await carregarPerfis();
  // revogar SÓ depois do snapshot sem o perfil assentar (review PR #52);
  // <img> já carregado não quebra com revoke — o prazo cobre os pendentes
  revogarUrls(id);
}

/** Callbacks de limpeza pós-apagar (preferencias registra o dela — sem ciclo). */
export const aoApagarPerfil = new Set<(id: string) => void>();
