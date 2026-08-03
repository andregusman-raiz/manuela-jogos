import type { Desenho } from "./desenho/tipos";
import { LOJA_ATELIE, abrirBd, bdSuportado } from "./bd";
import { idJogadorSalvo } from "./perfis";

/**
 * Guarda tudo no aparelho (IndexedDB). Nenhum dado sai daqui: não há conta,
 * servidor nem analytics no app.
 *
 * Duas gavetas:
 *   rascunho — o desenho em andamento, salvo a cada traço. É o que garante que
 *              fechar o navegador no meio nunca perde nada.
 *   galeria  — os desenhos que a criança guardou, com miniatura.
 *
 * Sem biblioteca de wrapper: são cinco operações e um `openDB` — dependência
 * aqui só aumentaria o bundle que precisa abrir em 3s no 4G.
 */

export type { LojaJogo } from "./bd";
import type { LojaJogo } from "./bd";
const ID_RASCUNHO = "rascunho";
const PERFIL_LEGADO = "manuela"; // dono histórico do dado sem perfil (SPEC memoria-por-perfil §2)

function idProgresso(perfil: string): string {
  return `progresso:${perfil}`;
}

function idRascunho(perfil: string): string {
  return `${ID_RASCUNHO}:${perfil}`;
}

/** Todo id de rascunho, legado ("rascunho") ou por perfil ("rascunho:leo"). */
export function ehRascunho(id: string): boolean {
  return id === ID_RASCUNHO || id.startsWith(`${ID_RASCUNHO}:`);
}

async function comLoja<T>(
  nomeLoja: string,
  modo: IDBTransactionMode,
  acao: (loja: IDBObjectStore) => IDBRequest<T>,
): Promise<T | null> {
  if (!bdSuportado()) return null;
  try {
    const bd = await abrirBd();
    return await new Promise<T | null>((resolve, reject) => {
      const tx = bd.transaction(nomeLoja, modo);
      const pedido = acao(tx.objectStore(nomeLoja));
      pedido.onsuccess = () => resolve(pedido.result);
      pedido.onerror = () => reject(pedido.error);
      // fechar em TODOS os finais — conexão vazada em erro segura upgrades de
      // outras abas para sempre (é a invariante que permite esperar o blocked)
      tx.oncomplete = () => bd.close();
      tx.onabort = () => {
        bd.close();
        reject(tx.error);
      };
    });
  } catch {
    // Modo privado / cota cheia: o app continua desenhando, só não persiste.
    return null;
  }
}

export async function salvarRascunho(desenho: Desenho): Promise<void> {
  const perfil = idJogadorSalvo();
  await comLoja(LOJA_ATELIE, "readwrite", (loja) => loja.put({ ...desenho, id: idRascunho(perfil) }));
}

export async function carregarRascunho(): Promise<Desenho | null> {
  const perfil = idJogadorSalvo();
  const novo = await comLoja<Desenho>(LOJA_ATELIE, "readonly", (loja) => loja.get(idRascunho(perfil)));
  if (novo) return novo;
  // rascunho de antes dos perfis pertence à Manuela (decisão de produto)
  if (perfil !== PERFIL_LEGADO) return null;
  const legado = await comLoja<Desenho>(LOJA_ATELIE, "readonly", (loja) => loja.get(ID_RASCUNHO));
  return legado ?? null;
}

export async function apagarRascunho(): Promise<void> {
  const perfil = idJogadorSalvo();
  await comLoja(LOJA_ATELIE, "readwrite", (loja) => {
    // comLoja resolve pelo onsuccess do request RETORNADO: o delete do legado
    // (Manuela) precisa ser o último da transação — sem ele o rascunho velho
    // ressuscitaria no próximo carregar
    if (perfil !== PERFIL_LEGADO) return loja.delete(idRascunho(perfil));
    loja.delete(idRascunho(perfil));
    return loja.delete(ID_RASCUNHO);
  });
}

/**
 * Guarda na galeria. Com `idExistente`, ATUALIZA aquele item em vez de criar
 * outro — é o que impede a galeria de encher de cópias quando a criança guarda
 * duas vezes ou continua um desenho já guardado.
 */
export async function guardarNaGaleria(desenho: Desenho, idExistente?: string): Promise<string> {
  // dono capturado NA ENTRADA (review PR #50): trocar de perfil com um guardar
  // em voo não pode transferir nem sobrescrever desenho de outra criança
  const perfilDaAcao = idJogadorSalvo();
  const id =
    idExistente && !ehRascunho(idExistente)
      ? idExistente
      : `d-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  // galeriaId é metadado do rascunho; num item da galeria seria auto-referência
  const { galeriaId: _descartado, ...limpo } = desenho;
  void _descartado;
  if (!bdSuportado()) return id;
  try {
    const bd = await abrirBd();
    await new Promise<void>((resolve, reject) => {
      const tx = bd.transaction(LOJA_ATELIE, "readwrite");
      const loja = tx.objectStore(LOJA_ATELIE);
      const leitura = loja.get(id);
      leitura.onsuccess = () => {
        const existente = (leitura.result ?? null) as (Desenho & { perfil?: string }) | null;
        // atualização preserva o DONO REAL do registro (legado = Manuela);
        // desenho novo pertence a quem iniciou a ação
        const dono = existente ? (existente.perfil ?? PERFIL_LEGADO) : perfilDaAcao;
        loja.put({ ...limpo, id, perfil: dono });
      };
      tx.oncomplete = () => {
        bd.close();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => {
        bd.close();
        reject(tx.error);
      };
    });
  } catch {
    // sem persistência: o desenho segue na tela
  }
  return id;
}

export async function listarGaleria(): Promise<Desenho[]> {
  const todos = await comLoja<Desenho[]>(LOJA_ATELIE, "readonly", (loja) => loja.getAll());
  if (!todos) return [];
  const perfil = idJogadorSalvo();
  return todos
    .filter((d) => !ehRascunho(d.id))
    // desenho sem carimbo é de antes dos perfis: pertence à Manuela
    .filter((d) => d.perfil === perfil || (perfil === PERFIL_LEGADO && d.perfil == null))
    .sort((a, b) => b.atualizadoEm - a.atualizadoEm);
}

export async function apagarDaGaleria(id: string): Promise<void> {
  if (ehRascunho(id)) return;
  await comLoja(LOJA_ATELIE, "readwrite", (loja) => loja.delete(id));
}

export async function buscarDesenho(id: string): Promise<Desenho | null> {
  const r = await comLoja<Desenho>(LOJA_ATELIE, "readonly", (loja) => loja.get(id));
  return r ?? null;
}

/**
 * Progresso dos jogos — um registro por gaveta. `melhor` só tem semântica na
 * Memória (menor nº de tentativas); nos outros jogos fica null. Começa null de
 * propósito: min() com 0 congelaria o recorde para sempre.
 */
export type Progresso = {
  id: string;
  nivel: number;
  melhor: number | null;
  atualizadoEm: number;
};

export async function lerProgresso(jogo: LojaJogo): Promise<Progresso | null> {
  const perfil = idJogadorSalvo();
  const novo = await comLoja<Progresso>(jogo, "readonly", (loja) => loja.get(idProgresso(perfil)));
  if (novo) return novo;
  if (perfil !== PERFIL_LEGADO) return null;
  // progresso de antes dos perfis pertence à Manuela (decisão de produto)
  const legado = await comLoja<Progresso>(jogo, "readonly", (loja) => loja.get("progresso"));
  return legado ?? null;
}

/** Leitura genérica de um registro (readonly — NUNCA grava; ler o placar das
 *  Damas com atualizarRegistro criava um registro zerado só de visitar). */
export async function lerRegistro<T extends { id: string }>(
  jogo: LojaJogo,
  id: string,
): Promise<T | null> {
  const r = await comLoja<T>(jogo, "readonly", (loja) => loja.get(id));
  return r ?? null;
}

/**
 * Read-modify-write genérico numa ÚNICA transação readwrite: para registros
 * que INCREMENTAM (ex.: placar das Damas) — o Progresso monotônico não serve,
 * Math.max de duas abas perderia uma contagem.
 */
export async function atualizarRegistro<T extends { id: string }>(
  jogo: LojaJogo,
  id: string,
  atualizar: (atual: T | null) => T,
): Promise<void> {
  if (!bdSuportado()) return;
  try {
    const bd = await abrirBd();
    await new Promise<void>((resolve, reject) => {
      const tx = bd.transaction(jogo, "readwrite");
      const loja = tx.objectStore(jogo);
      const leitura = loja.get(id);
      leitura.onsuccess = () => {
        loja.put(atualizar((leitura.result as T | undefined) ?? null));
      };
      tx.oncomplete = () => {
        bd.close();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => {
        bd.close();
        reject(tx.error);
      };
    });
  } catch {
    // sem persistência: o jogo segue em memória
  }
}

/**
 * Gravação MONOTÔNICA: nível só sobe, recorde só melhora. Ler e gravar na
 * MESMA transação readwrite — o IndexedDB serializa transações de escrita por
 * gaveta, então duas abas nunca regridem o progresso uma da outra.
 */
export async function salvarProgresso(
  jogo: LojaJogo,
  nivel: number,
  melhor: number | null = null,
): Promise<void> {
  if (!bdSuportado()) return;
  // capturado ANTES de qualquer await: troca de perfil no meio não mistura chaves
  const perfil = idJogadorSalvo();
  try {
    const bd = await abrirBd();
    await new Promise<void>((resolve, reject) => {
      const tx = bd.transaction(jogo, "readwrite");
      const loja = tx.objectStore(jogo);
      const gravar = (atual: Progresso | null) => {
        loja.put({
          id: idProgresso(perfil),
          nivel: Math.max(atual?.nivel ?? 1, nivel),
          melhor:
            atual?.melhor == null
              ? melhor
              : melhor == null
                ? atual.melhor
                : Math.min(atual.melhor, melhor),
          atualizadoEm: Date.now(),
        } satisfies Progresso);
      };
      // fallback do legado DENTRO da tx (juiz B2): senão o recorde antigo da
      // Manuela seria sombreado pela primeira gravação na chave nova
      const leitura = loja.get(idProgresso(perfil));
      leitura.onsuccess = () => {
        const atual = (leitura.result ?? null) as Progresso | null;
        if (atual || perfil !== PERFIL_LEGADO) {
          gravar(atual);
          return;
        }
        const legado = loja.get("progresso");
        legado.onsuccess = () => gravar((legado.result ?? null) as Progresso | null);
      };
      tx.oncomplete = () => {
        bd.close();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => {
        bd.close();
        reject(tx.error);
      };
    });
  } catch {
    // Sem persistência (modo privado, aba bloqueada): o jogo segue em memória.
  }
}
