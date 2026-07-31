/**
 * Peças e silhuetas do Tangram da Manu — SPEC onda 3 §3.3.
 * Canvas lógico 200×200. Cada peça é um polígono LOCAL (centroide na origem);
 * a pose {x, y, rotacao, espelhado} posiciona no tabuleiro.
 */

export type NomePeca = "g1" | "g2" | "m" | "p1" | "p2" | "q" | "para";

export type Pose = { x: number; y: number; rotacao: number; espelhado: boolean };

export type Alvo = Pose & { peca: NomePeca };

export type Silhueta = { nome: string; alvos: Alvo[] };

/** Simetria rotacional (graus) de cada peça — o encaixe aceita módulo isto. */
export const SIMETRIA: Record<NomePeca, number> = {
  g1: 360,
  g2: 360,
  m: 360,
  p1: 360,
  p2: 360,
  q: 90,
  para: 180,
};

/** O paralelogramo é a única peça quiral (espelho importa). */
export const QUIRAL: Record<NomePeca, boolean> = {
  g1: false,
  g2: false,
  m: false,
  p1: false,
  p2: false,
  q: false,
  para: true,
};

const TRI = (perna: number): [number, number][] => {
  const c = perna / 3;
  return [
    [-c, -c],
    [perna - c, -c],
    [-c, perna - c],
  ];
};

/** Vértices locais (centroide na origem). Proporções do tangram clássico. */
export const VERTICES: Record<NomePeca, [number, number][]> = {
  g1: TRI(44),
  g2: TRI(44),
  m: TRI(31),
  p1: TRI(22),
  p2: TRI(22),
  q: [
    [-11, -11],
    [11, -11],
    [11, 11],
    [-11, 11],
  ],
  para: [
    [-23.2, -7.8],
    [7.8, -7.8],
    [23.2, 7.8],
    [-7.8, 7.8],
  ],
};

export const CORES_PECAS: Record<NomePeca, string> = {
  g1: "#f09bc0",
  g2: "#aedede",
  m: "#f8de7b",
  p1: "#b8dca6",
  p2: "#eaa266",
  q: "#c9a8e0",
  para: "#e8a0a0",
};

/**
 * 10 silhuetas desenhadas à mão. Invariantes (testadas): cada peça 1× por
 * silhueta; centros ≥24px par a par; união CONEXA.
 */
export const SILHUETAS: Silhueta[] = [
  {
    nome: "casa",
    alvos: [
      { peca: "g1", x: 85, y: 130, rotacao: 0, espelhado: false },
      { peca: "g2", x: 120, y: 130, rotacao: 180, espelhado: false },
      { peca: "m", x: 100, y: 88, rotacao: 45, espelhado: false },
      { peca: "q", x: 100, y: 158, rotacao: 0, espelhado: false },
      { peca: "p1", x: 70, y: 95, rotacao: 0, espelhado: false },
      { peca: "p2", x: 130, y: 95, rotacao: 90, espelhado: false },
      { peca: "para", x: 100, y: 64, rotacao: 0, espelhado: false },
    ],
  },
  {
    nome: "gato",
    alvos: [
      { peca: "g1", x: 100, y: 140, rotacao: 45, espelhado: false },
      { peca: "g2", x: 100, y: 105, rotacao: 225, espelhado: false },
      { peca: "m", x: 100, y: 80, rotacao: 0, espelhado: false },
      { peca: "p1", x: 78, y: 54, rotacao: 0, espelhado: false },
      { peca: "p2", x: 122, y: 54, rotacao: 90, espelhado: false },
      { peca: "q", x: 138, y: 150, rotacao: 45, espelhado: false },
      { peca: "para", x: 65, y: 160, rotacao: 90, espelhado: false },
    ],
  },
  {
    nome: "barco",
    alvos: [
      { peca: "g1", x: 80, y: 140, rotacao: 90, espelhado: false },
      { peca: "g2", x: 112, y: 140, rotacao: 270, espelhado: false },
      { peca: "m", x: 96, y: 109, rotacao: 0, espelhado: false },
      { peca: "q", x: 78, y: 90, rotacao: 0, espelhado: false },
      { peca: "p1", x: 60, y: 74, rotacao: 45, espelhado: false },
      { peca: "p2", x: 120, y: 90, rotacao: 135, espelhado: false },
      { peca: "para", x: 102, y: 168, rotacao: 0, espelhado: false },
    ],
  },
  {
    nome: "passaro",
    alvos: [
      { peca: "g1", x: 95, y: 115, rotacao: 45, espelhado: false },
      { peca: "g2", x: 135, y: 115, rotacao: 225, espelhado: false },
      { peca: "m", x: 62, y: 95, rotacao: 90, espelhado: false },
      { peca: "p1", x: 40, y: 78, rotacao: 45, espelhado: false },
      { peca: "p2", x: 160, y: 145, rotacao: 315, espelhado: false },
      { peca: "q", x: 115, y: 152, rotacao: 45, espelhado: false },
      { peca: "para", x: 115, y: 83, rotacao: 135, espelhado: false },
    ],
  },
  {
    nome: "arvore",
    alvos: [
      { peca: "g1", x: 100, y: 60, rotacao: 135, espelhado: false },
      { peca: "g2", x: 100, y: 95, rotacao: 135, espelhado: false },
      { peca: "m", x: 100, y: 125, rotacao: 135, espelhado: false },
      { peca: "q", x: 100, y: 153, rotacao: 0, espelhado: false },
      { peca: "p1", x: 83, y: 36, rotacao: 315, espelhado: false },
      { peca: "p2", x: 122, y: 105, rotacao: 225, espelhado: false },
      { peca: "para", x: 116, y: 173, rotacao: 0, espelhado: false },
    ],
  },
  {
    nome: "peixe",
    alvos: [
      { peca: "q", x: 62, y: 100, rotacao: 45, espelhado: false },
      { peca: "g1", x: 90, y: 100, rotacao: 315, espelhado: false },
      { peca: "g2", x: 112, y: 110, rotacao: 135, espelhado: false },
      { peca: "m", x: 148, y: 103, rotacao: 90, espelhado: false },
      { peca: "p1", x: 172, y: 86, rotacao: 45, espelhado: false },
      { peca: "p2", x: 164, y: 122, rotacao: 135, espelhado: false },
      { peca: "para", x: 38, y: 100, rotacao: 90, espelhado: false },
    ],
  },
  {
    nome: "foguete",
    alvos: [
      { peca: "m", x: 100, y: 45, rotacao: 45, espelhado: false },
      { peca: "q", x: 114.2, y: 64.9, rotacao: 0, espelhado: false },
      { peca: "g1", x: 100, y: 97, rotacao: 45, espelhado: false },
      { peca: "g2", x: 108.9, y: 119.6, rotacao: 225, espelhado: false },
      { peca: "p1", x: 68, y: 151, rotacao: 180, espelhado: false },
      { peca: "p2", x: 132, y: 151, rotacao: 270, espelhado: false },
      { peca: "para", x: 100, y: 168, rotacao: 0, espelhado: false },
    ],
  },
  {
    nome: "coelho",
    alvos: [
      { peca: "p1", x: 82, y: 35, rotacao: 90, espelhado: false },
      { peca: "p2", x: 112, y: 35, rotacao: 0, espelhado: false },
      { peca: "q", x: 97, y: 60, rotacao: 0, espelhado: false },
      { peca: "m", x: 97, y: 84, rotacao: 45, espelhado: false },
      { peca: "g1", x: 97, y: 112, rotacao: 45, espelhado: false },
      { peca: "g2", x: 105.9, y: 134.6, rotacao: 225, espelhado: false },
      { peca: "para", x: 136, y: 150, rotacao: 90, espelhado: false },
    ],
  },
  {
    nome: "coracao",
    alvos: [
      { peca: "p1", x: 75, y: 60, rotacao: 225, espelhado: false },
      { peca: "p2", x: 125, y: 60, rotacao: 315, espelhado: false },
      { peca: "q", x: 100, y: 78, rotacao: 45, espelhado: false },
      { peca: "g1", x: 75, y: 105, rotacao: 315, espelhado: false },
      { peca: "g2", x: 125, y: 105, rotacao: 45, espelhado: false },
      { peca: "m", x: 100, y: 145, rotacao: 225, espelhado: false },
      { peca: "para", x: 116, y: 166, rotacao: 0, espelhado: false },
    ],
  },
  {
    nome: "estrela",
    alvos: [
      { peca: "q", x: 100, y: 100, rotacao: 45, espelhado: false },
      { peca: "p1", x: 100, y: 72, rotacao: 225, espelhado: false },
      { peca: "p2", x: 128, y: 100, rotacao: 315, espelhado: false },
      { peca: "m", x: 100, y: 128, rotacao: 45, espelhado: false },
      { peca: "g1", x: 60, y: 100, rotacao: 45, espelhado: false },
      { peca: "g2", x: 100, y: 36, rotacao: 135, espelhado: false },
      { peca: "para", x: 42, y: 122, rotacao: 135, espelhado: false },
    ],
  },
];
