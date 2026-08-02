/**
 * Perfis de jogador (fase 2 da identidade): o registro de quem pode jogar e a
 * escolha ativa. Escolher um perfil troca nome, gênero E figura no app
 * inteiro — os componentes assinam via `usePerfil()`/`useIdentidade()`
 * (lib/usePerfil.ts) e os textos flexionam pelos helpers de lib/identidade.
 *
 * Perfil novo = 1 entrada em PERFIS (+ assets em /public/<slug>/).
 * A escolha vive em localStorage ("manu:jogador"), padrão useSyncExternalStore.
 */

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

/** Perfil ativo: o escolhido, ou o primeiro (default) enquanto não há escolha. */
export function perfilAtivo(): Perfil {
  const id = lerJogador();
  return PERFIS.find((p) => p.id === id) ?? PERFIS[0];
}

export function perfilNoServidor(): Perfil {
  return PERFIS[0];
}
