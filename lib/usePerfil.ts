"use client";

import { useSyncExternalStore } from "react";
import type { Identidade } from "./identidade";
import { assinarJogador, perfilAtivo, perfilNoServidor, type Perfil } from "./perfis";

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
