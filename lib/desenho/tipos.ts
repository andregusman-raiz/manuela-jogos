/** Tipos do Ateliê da Manu. */

export type Ponto = {
  x: number;
  y: number;
  /** 0..1 — força do traço, derivada da velocidade do dedo. */
  f: number;
};

export type TipoPincel =
  | "lapis"
  | "pincel"
  | "marcador"
  | "giz"
  | "spray"
  | "neon"
  | "arcoiris"
  | "glitter"
  | "borracha";

export type TipoForma = "circulo" | "quadrado" | "coracao" | "estrela" | "linha";

/** Espelhamento: 1 = normal, 2/4/8 = mandala. */
export type Simetria = 1 | 2 | 4 | 8;

export type OperacaoTraco = {
  kind: "traco";
  pincel: TipoPincel;
  cor: string;
  espessura: number;
  simetria: Simetria;
  pontos: Ponto[];
};

export type OperacaoCarimbo = {
  kind: "carimbo";
  emoji: string;
  x: number;
  y: number;
  tamanho: number;
  giro: number;
};

export type OperacaoForma = {
  kind: "forma";
  forma: TipoForma;
  cor: string;
  espessura: number;
  preenchida: boolean;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

export type OperacaoBalde = {
  kind: "balde";
  cor: string;
  x: number;
  y: number;
};

export type OperacaoFundo = {
  kind: "fundo";
  cor: string;
};

/**
 * Pintura de uma região do livro de colorir.
 *
 * No livro, cada área do desenho é um path de SVG com id próprio — pintar é
 * trocar o `fill` daquele path, então nunca vaza nem sobra branco na borda.
 * Fica no mesmo histórico dos traços para que o desfazer seja um só.
 */
export type OperacaoRegiao = {
  kind: "regiao";
  regiao: string;
  cor: string;
};

export type Operacao =
  | OperacaoTraco
  | OperacaoCarimbo
  | OperacaoForma
  | OperacaoBalde
  | OperacaoFundo
  | OperacaoRegiao;

export type Desenho = {
  id: string;
  criadoEm: number;
  atualizadoEm: number;
  largura: number;
  altura: number;
  operacoes: Operacao[];
  /** Slug do desenho de colorir por baixo, quando houver. */
  colorir?: string;
  /** PNG em dataURL, só nos desenhos guardados na galeria. */
  miniatura?: string;
};
