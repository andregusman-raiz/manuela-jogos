/**
 * Perfis de jogador (fase 2 da identidade, primeiro passo): o registro de
 * quem pode jogar e a escolha ativa. Por enquanto há UM perfil (a Manuela) —
 * a tela "Quem vai jogar?" já existe e novos perfis entram SÓ aqui.
 *
 * A escolha vive em localStorage ("manu:jogador") no mesmo padrão
 * useSyncExternalStore de lib/preferencias.ts. Escolher perfil NÃO muda a
 * identidade em runtime ainda (IDENTIDADE segue constante — o único perfil É
 * a Manuela); quando houver 2+, o passo seguinte liga o perfil ao override.
 */

import { IDENTIDADE, MASCOTE, type Identidade } from "./identidade";

export interface Perfil {
  id: string;
  identidade: Identidade;
  figura: { src: string; largura: number; altura: number };
}

export const PERFIS: readonly Perfil[] = [
  { id: "manuela", identidade: IDENTIDADE, figura: MASCOTE.corpo },
];

/** Exportada para o script anti-FOUC do hub (o literal vive só aqui). */
export const CHAVE_JOGADOR = "manu:jogador";

let cache: string | null | undefined; // undefined = ainda não lido
const ouvintes = new Set<() => void>();

/** Id do jogador escolhido, ou null se ninguém escolheu ainda. */
export function lerJogador(): string | null {
  if (typeof localStorage === "undefined") return null;
  if (cache === undefined) {
    try {
      const bruto = localStorage.getItem(CHAVE_JOGADOR);
      cache = PERFIS.some((p) => p.id === bruto) ? bruto : null;
    } catch {
      // storage bloqueado (SecurityError): cai na escolha, não derruba o hub
      cache = null;
    }
  }
  return cache;
}

export function salvarJogador(id: string): void {
  if (!PERFIS.some((p) => p.id === id)) return;
  cache = id;
  for (const avisar of ouvintes) avisar();
  try {
    localStorage.setItem(CHAVE_JOGADOR, id);
  } catch {
    // sem persistência a escolha vale só para a sessão
  }
}

/** Volta para a tela de escolha (botão "trocar jogador"). */
export function limparJogador(): void {
  cache = null;
  for (const avisar of ouvintes) avisar();
  try {
    localStorage.removeItem(CHAVE_JOGADOR);
  } catch {
    // idem
  }
}

export function assinarJogador(avisar: () => void): () => void {
  ouvintes.add(avisar);
  return () => ouvintes.delete(avisar);
}

/** No servidor sempre há jogador (o hub SSR é o caso comum pós-escolha). */
export function jogadorNoServidor(): string | null {
  return PERFIS[0].id;
}
