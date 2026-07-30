export type Nivel = 1 | 2 | 3 | 4 | 5;

export type Rodada = {
  /** Conta exibida no meteoro, ex.: "3 + 4", "12 − 5", "7 × 8". */
  conta: string;
  resposta: number;
  /** 4 opções embaralhadas, únicas, >= 0, contendo a resposta. */
  opcoes: number[];
};

/**
 * Fases da rodada. A transição é ATÔMICA: só "caindo" aceita eventos de
 * resolução — toque certo e chegada à base no mesmo instante nunca contam os
 * dois (o primeiro vence, o segundo é ignorado).
 */
export type FaseRodada = "caindo" | "resolvida" | "quicou" | "fase-completa";

export type EstadoJogo = {
  nivel: Nivel;
  rodada: Rodada;
  fase: FaseRodada;
  /** Acertos na fase atual (0..ACERTOS_POR_FASE). */
  acertos: number;
  /** Conta que quicou e voltou ao topo: desce mais devagar. */
  reapresentada: boolean;
};

export type Evento = "toque-certo" | "chegou-base" | "proxima";
