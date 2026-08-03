"use client";

import { useSyncExternalStore } from "react";
import type { Identidade } from "./identidade";
import {
  PERFIS,
  assinarJogador,
  carregarPerfis,
  listarPerfis,
  perfilAtivo,
  perfilNoServidor,
  registroPronto,
  type Perfil,
} from "./perfis";

// boot do catálogo dinâmico: uma vez por sessão, no primeiro import client
if (typeof window !== "undefined") void carregarPerfis();

const FABRICA = [...PERFIS];

export function usePerfis(): Perfil[] {
  return useSyncExternalStore(assinarJogador, listarPerfis, () => FABRICA);
}

export function useRegistroPronto(): boolean {
  return useSyncExternalStore(assinarJogador, registroPronto, () => true);
}

/**
 * Assinatura reativa do perfil escolhido (fase 2 da identidade): quem usa
 * estes hooks re-renderiza quando o jogador troca — sem mismatch de
 * hidratação (o snapshot do servidor é o perfil default).
 */
export function usePerfil(): Perfil {
  return useSyncExternalStore(assinarJogador, perfilAtivo, perfilNoServidor);
}

export function useIdentidade(): Identidade {
  return usePerfil().identidade;
}
