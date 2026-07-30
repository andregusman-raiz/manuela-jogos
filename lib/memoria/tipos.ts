export type NivelMemoria = 1 | 2 | 3;

export type Carta = {
  /** Posição fixa no tabuleiro (índice estável para o React e para o toque). */
  id: number;
  /** Pareamento EXPLÍCITO — nunca por igualdade visual (SPEC §4.2). */
  parId: number;
  /** O que aparece na carta aberta: emoji, "3 × 4" ou "12". */
  face: string;
  /** No nível 3 diferencia o visual: conta tem fundo azul, resultado branco. */
  tipo: "emoji" | "conta" | "resultado";
};

/**
 * Máquina do tabuleiro (SPEC §4.2): em "resolvendo" (2 abertas, janela de
 * 900ms) todo toque é ignorado; carta aberta/removida é no-op em qualquer
 * fase. Tentativa = par revelado, nunca toque avulso.
 */
export type FaseTabuleiro = "livre" | "uma-aberta" | "resolvendo" | "completa";

export type EstadoTabuleiro = {
  nivel: NivelMemoria;
  cartas: Carta[];
  /** ids das cartas viradas para cima agora (0, 1 ou 2). */
  abertas: number[];
  /** ids já pareados e removidos do jogo. */
  removidas: number[];
  tentativas: number;
  fase: FaseTabuleiro;
};
