import type { Simetria, TipoForma, TipoPincel } from "./tipos";

export type ModoFerramenta = "pincel" | "balde" | "carimbo" | "forma";

export type Ferramenta = {
  modo: ModoFerramenta;
  /** Vale quando modo = "pincel" (a borracha é um pincel que apaga). */
  pincel: TipoPincel;
  carimbo: string;
  forma: TipoForma;
  espessura: number;
  cor: string;
  simetria: Simetria;
};

/**
 * Os pincéis em duas camadas.
 *
 * `basicos` ficam à mão na barra: resolvem a criança de 6 anos.
 * `especiais` moram na bandeja — quem tem 9-10 descobre explorando, e é aí que
 * está o efeito "uau" (neon, arco-íris, glitter).
 */
export const PINCEIS_BASICOS: Array<{ tipo: TipoPincel; emoji: string; nome: string }> = [
  { tipo: "lapis", emoji: "✏️", nome: "lápis" },
  { tipo: "pincel", emoji: "🖌️", nome: "pincel" },
  { tipo: "marcador", emoji: "🖊️", nome: "caneta" },
  { tipo: "giz", emoji: "🖍️", nome: "giz de cera" },
];

export const PINCEIS_ESPECIAIS: Array<{ tipo: TipoPincel; emoji: string; nome: string }> = [
  { tipo: "spray", emoji: "💨", nome: "spray" },
  { tipo: "neon", emoji: "💡", nome: "neon" },
  { tipo: "arcoiris", emoji: "🌈", nome: "arco-íris" },
  { tipo: "glitter", emoji: "✨", nome: "glitter" },
];

export const TODOS_PINCEIS = [...PINCEIS_BASICOS, ...PINCEIS_ESPECIAIS];

export const SIMETRIAS: Array<{ valor: Simetria; emoji: string; nome: string }> = [
  { valor: 1, emoji: "🚫", nome: "sem espelho" },
  { valor: 2, emoji: "🦋", nome: "borboleta" },
  { valor: 4, emoji: "🍀", nome: "quatro lados" },
  { valor: 8, emoji: "❄️", nome: "mandala" },
];

export const FERRAMENTA_INICIAL: Ferramenta = {
  modo: "pincel",
  pincel: "pincel",
  carimbo: "⭐",
  forma: "circulo",
  espessura: 14,
  cor: "#E5352B",
  simetria: 1,
};
