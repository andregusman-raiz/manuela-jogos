export type Direcao = "norte" | "sul" | "leste" | "oeste";

/**
 * Semântica FECHADA na SPEC §4.3 (modelo Blockly Games Maze): `frente` avança
 * 1 célula na direção atual; os giros são PUROS (90°, não avançam). É o giro
 * relativo que se ensina.
 */
export type Comando = "frente" | "girar-esquerda" | "girar-direita";

export type Fase = {
  /** Linhas do tabuleiro: '.' livre, '#' parede, 'M' Manu, 'E' estrela. */
  grade: string[];
  direcaoInicial: Direcao;
};

export type Posicao = { x: number; y: number; direcao: Direcao };

export type Execucao = {
  /** Estado após CADA comando da fila, na ordem (para a animação). */
  passos: Posicao[];
  resultado: "estrela" | "parede" | "fim-da-fila";
};
