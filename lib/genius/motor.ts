import { criarRng } from "@/lib/contas/motor";

/**
 * Motor do Genius dos Sons — SPEC onda 2 §3.4, máquina COMPLETA e pura.
 * A sequência inteira nasce pré-gerada até o alvo: o crescimento é
 * determinístico por construção. Erro nunca encolhe — a MESMA sequência
 * toca de novo. Sem game over.
 */

export { criarRng };

export const SEQUENCIA_ALVO = 8;
export const TAMANHO_INICIAL = 2;
export const BOTOES = 4;

export type FaseGenius = "mostrando" | "ouvindo" | "fase-completa";

export type EstadoGenius = {
  /** Pré-gerada até SEQUENCIA_ALVO; a rodada usa o prefixo de `tamanho`. */
  sequencia: number[];
  tamanho: number;
  fase: FaseGenius;
  /** Próximo item do replay (fase mostrando). */
  indiceReplay: number;
  /** Próximo item esperado da criança (fase ouvindo). */
  posicao: number;
};

export function criarPartida(seed: number): EstadoGenius {
  const rng = criarRng(seed);
  const sequencia = Array.from({ length: SEQUENCIA_ALVO }, () => Math.floor(rng() * BOTOES));
  return { sequencia, tamanho: TAMANHO_INICIAL, fase: "mostrando", indiceReplay: 0, posicao: 0 };
}

/**
 * Evento puro do replay: consome UM item mostrado. Depois do último item do
 * prefixo, a vez é da criança (ouvindo). Fora de "mostrando": mesma referência.
 */
export function avancarReplay(estado: EstadoGenius): EstadoGenius {
  if (estado.fase !== "mostrando") return estado;
  const proximo = estado.indiceReplay + 1;
  if (proximo >= estado.tamanho) {
    return { ...estado, fase: "ouvindo", indiceReplay: 0, posicao: 0 };
  }
  return { ...estado, indiceReplay: proximo };
}

/**
 * Toque da criança. Fora de "ouvindo": mesma referência (toques durante o
 * replay são ignorados NO MOTOR). Erro volta a mostrar o MESMO prefixo.
 */
export function ouvir(estado: EstadoGenius, botao: number): EstadoGenius {
  if (estado.fase !== "ouvindo") return estado;

  if (botao !== estado.sequencia[estado.posicao]) {
    return { ...estado, fase: "mostrando", indiceReplay: 0, posicao: 0 };
  }

  const posicao = estado.posicao + 1;
  if (posicao < estado.tamanho) return { ...estado, posicao };

  // repetiu o prefixo inteiro: cresce ou completa
  if (estado.tamanho >= SEQUENCIA_ALVO) return { ...estado, posicao, fase: "fase-completa" };
  return {
    ...estado,
    tamanho: estado.tamanho + 1,
    fase: "mostrando",
    indiceReplay: 0,
    posicao: 0,
  };
}
