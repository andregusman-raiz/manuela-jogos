/**
 * Geometria do tabuleiro 15×15 (coordenadas [coluna, linha], origem no topo).
 * TRILHA[g] = célula da casa global g. Deduzida da SPEC §1.1: SAIDA em
 * 0/13/26/39, sentido horário, colunas finais na linha/coluna 7 de cada braço.
 */

import type { CorLudo } from "./motor";

export type Celula = [number, number];

export const TRILHA: readonly Celula[] = [
  // g0..g4 — braço esquerdo, linha de cima (SAIDA cor 0 em g0)
  [1, 6], [2, 6], [3, 6], [4, 6], [5, 6],
  // g5..g10 — sobe a coluna esquerda do braço de cima
  [6, 5], [6, 4], [6, 3], [6, 2], [6, 1], [6, 0],
  // g11..g12 — cruza o topo
  [7, 0], [8, 0],
  // g13..g17 — desce a coluna direita do braço de cima (SAIDA cor 1 em g13)
  [8, 1], [8, 2], [8, 3], [8, 4], [8, 5],
  // g18..g23 — braço direito, linha de cima
  [9, 6], [10, 6], [11, 6], [12, 6], [13, 6], [14, 6],
  // g24..g25 — desce a ponta direita
  [14, 7], [14, 8],
  // g26..g30 — braço direito, linha de baixo, voltando (SAIDA cor 2 em g26)
  [13, 8], [12, 8], [11, 8], [10, 8], [9, 8],
  // g31..g36 — desce a coluna direita do braço de baixo
  [8, 9], [8, 10], [8, 11], [8, 12], [8, 13], [8, 14],
  // g37..g38 — cruza a base
  [7, 14], [6, 14],
  // g39..g43 — sobe a coluna esquerda do braço de baixo (SAIDA cor 3 em g39)
  [6, 13], [6, 12], [6, 11], [6, 10], [6, 9],
  // g44..g49 — braço esquerdo, linha de baixo, voltando
  [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8],
  // g50..g51 — sobe a ponta esquerda (g51 é a casa que a cor 0 PULA)
  [0, 7], [0, 6],
];

/** Coluna final de cada cor: progresso 51..55, na ordem. */
export const COLUNA_FINAL: Record<CorLudo, readonly Celula[]> = {
  0: [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7]],
  1: [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5]],
  2: [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7]],
  3: [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9]],
};

/** Slots dos peões dentro da base (cantos 6×6), até 4 por cor. */
export const BASE_SLOTS: Record<CorLudo, readonly Celula[]> = {
  0: [[1.5, 1.5], [3.5, 1.5], [1.5, 3.5], [3.5, 3.5]],
  1: [[10.5, 1.5], [12.5, 1.5], [10.5, 3.5], [12.5, 3.5]],
  2: [[10.5, 10.5], [12.5, 10.5], [10.5, 12.5], [12.5, 12.5]],
  3: [[1.5, 10.5], [3.5, 10.5], [1.5, 12.5], [3.5, 12.5]],
};

/** Canto [x, y] da área de base 6×6 de cada cor. */
export const BASE_CANTO: Record<CorLudo, Celula> = {
  0: [0, 0],
  1: [9, 0],
  2: [9, 9],
  3: [0, 9],
};

export const CENTRO: Celula = [7, 7];

export const CORES_LUDO: Record<CorLudo, { pele: string; borda: string; nome: string }> = {
  0: { pele: "#f09bc0", borda: "#b34f80", nome: "Rosa" },
  1: { pele: "#8fd0d9", borda: "#3f7f8c", nome: "Azul" },
  2: { pele: "#f8de7b", borda: "#a8842a", nome: "Amarelo" },
  3: { pele: "#a9d79b", borda: "#4f8a44", nome: "Verde" },
};
