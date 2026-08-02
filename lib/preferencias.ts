/**
 * Preferências do hub (quais jogos aparecem na tela inicial).
 *
 * localStorage, não IndexedDB: é uma preferência de UI minúscula e síncrona —
 * abrir o banco para isso custaria um bump de versão e um round-trip async à
 * toa. Continua "só neste aparelho", como promete o rodapé.
 */

import { JOGOS } from "./jogos";

const CHAVE = "manu-jogos-ocultos";
const NO_SERVIDOR: string[] = [];

// store externo no padrão do lib/som.ts: useSyncExternalStore precisa de
// snapshot com identidade ESTÁVEL entre leituras — cache invalidado no salvar
let cache: string[] | null = null;
const ouvintes = new Set<() => void>();

/** Ids ocultos VÁLIDOS (ids que saíram do manifesto são descartados). */
export function lerOcultos(): string[] {
  if (typeof localStorage === "undefined") return NO_SERVIDOR;
  if (cache !== null) return cache;
  try {
    const bruto: unknown = JSON.parse(localStorage.getItem(CHAVE) ?? "[]");
    const validos = new Set(JOGOS.map((j) => j.id));
    cache = Array.isArray(bruto)
      ? bruto.filter((id): id is string => typeof id === "string" && validos.has(id))
      : [];
  } catch {
    cache = [];
  }
  return cache;
}

export function salvarOcultos(ids: string[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(CHAVE, JSON.stringify(ids));
  cache = ids;
  for (const avisar of ouvintes) avisar();
}

export function assinarOcultos(avisar: () => void): () => void {
  ouvintes.add(avisar);
  return () => ouvintes.delete(avisar);
}

export function ocultosNoServidor(): string[] {
  return NO_SERVIDOR;
}
