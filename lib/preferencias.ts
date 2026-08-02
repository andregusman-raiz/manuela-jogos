/**
 * Preferências do hub POR PERFIL (quais jogos aparecem na tela inicial).
 *
 * localStorage, não IndexedDB: é uma preferência de UI minúscula e síncrona.
 * Chave `manu-jogos-ocultos:<perfil>`; a chave legada (sem perfil) pertence à
 * Manuela — fallback SÓ quando a chave nova nunca foi gravada (SPEC
 * memoria-por-perfil §2; sanitização e "pelo menos 1 visível" valem por
 * chave escolhida, nunca ressuscitam a legada).
 */

import { JOGOS } from "./jogos";
import { assinarJogador, perfilAtivo } from "./perfis";

const CHAVE_LEGADA = "manu-jogos-ocultos";
const PERFIL_LEGADO = "manuela";
const NO_SERVIDOR: string[] = [];

// snapshot estável POR PERFIL (useSyncExternalStore exige identidade estável)
const cache = new Map<string, string[]>();
const ouvintes = new Set<() => void>();

function chaveDe(perfil: string): string {
  return `${CHAVE_LEGADA}:${perfil}`;
}

function sanitizar(bruto: unknown): string[] {
  if (!Array.isArray(bruto)) return [];
  const validos = new Set(JOGOS.map((j) => j.id));
  const filtrados = bruto.filter(
    (id): id is string => typeof id === "string" && validos.has(id),
  );
  // storage adulterado com TODOS ocultos não deixa o hub vazio: libera o 1º
  return filtrados.length >= JOGOS.length
    ? filtrados.filter((id) => id !== JOGOS[0].id)
    : filtrados;
}

/** Ids ocultos VÁLIDOS do perfil ATIVO. */
export function lerOcultos(): string[] {
  if (typeof localStorage === "undefined") return NO_SERVIDOR;
  const perfil = perfilAtivo().id;
  const guardado = cache.get(perfil);
  if (guardado) return guardado;
  let resultado: string[] = [];
  try {
    const cru = localStorage.getItem(chaveDe(perfil));
    if (cru !== null) {
      resultado = sanitizar(JSON.parse(cru));
    } else if (perfil === PERFIL_LEGADO) {
      // config de antes dos perfis pertence à Manuela
      resultado = sanitizar(JSON.parse(localStorage.getItem(CHAVE_LEGADA) ?? "[]"));
    }
  } catch {
    resultado = [];
  }
  cache.set(perfil, resultado);
  return resultado;
}

export function salvarOcultos(ids: string[]): void {
  const perfil = perfilAtivo().id;
  // memória e assinantes atualizam SEMPRE (padrão do lib/som.ts): uma falha
  // de persistência (quota, modo privado) não pode congelar o seletor
  cache.set(perfil, ids);
  for (const avisar of ouvintes) avisar();
  try {
    localStorage.setItem(chaveDe(perfil), JSON.stringify(ids));
  } catch {
    // sem persistência a escolha vale só para a sessão
  }
}

export function assinarOcultos(avisar: () => void): () => void {
  ouvintes.add(avisar);
  // contrato do useSyncExternalStore (juiz da SPEC): o snapshot de ocultos
  // muda quando o JOGADOR troca — esta assinatura também precisa notificar
  const sairJogador = assinarJogador(avisar);
  return () => {
    ouvintes.delete(avisar);
    sairJogador();
  };
}

export function ocultosNoServidor(): string[] {
  return NO_SERVIDOR;
}
