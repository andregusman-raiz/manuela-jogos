/**
 * Livro de colorir — arte 100% ORIGINAL.
 *
 * Nenhum desenho vem de banco de imagens ou site de colorir: os termos do
 * desenhosecolorir.com.br (usado como referência de taxonomia) proíbem
 * redistribuição, e as categorias mais populares de lá são personagens
 * licenciados. O que copiamos é o ESTILO que funciona com criança — traço
 * grosso, formas simples, fofo — que não é protegido.
 *
 * Cada desenho é geometria declarada: a região pintável é um grupo de formas com
 * id. Pintar = trocar o `fill` do grupo, então nunca vaza e nunca sobra branco
 * na borda (o problema clássico do balde em bitmap).
 */

export type Forma =
  | { t: "circulo"; cx: number; cy: number; r: number }
  | { t: "elipse"; cx: number; cy: number; rx: number; ry: number; giro?: number }
  | { t: "retangulo"; x: number; y: number; l: number; a: number; raio?: number }
  | { t: "caminho"; d: string };

/** Área que a criança pode pintar. */
export type Regiao = {
  id: string;
  nome: string;
  formas: Forma[];
};

/** Traços que não se pintam: olhos, boca, bigodes, cratera. */
export type Detalhe = {
  formas: Forma[];
  /** Cor fixa de preenchimento; sem isso é só contorno. */
  preenchimento?: string;
  espessura?: number;
};

export type CategoriaColorir = "animais" | "dinossauros" | "castelo" | "espaco";

export type Pagina = {
  slug: string;
  nome: string;
  emoji: string;
  categoria: CategoriaColorir;
  /** Desenhos são quadrados: viewBox 0 0 lado lado. */
  lado: number;
  regioes: Regiao[];
  detalhes?: Detalhe[];
};

export const CATEGORIAS: Array<{ id: CategoriaColorir; nome: string; emoji: string }> = [
  { id: "animais", nome: "Animais fofos", emoji: "🐱" },
  { id: "dinossauros", nome: "Dinossauros", emoji: "🦕" },
  { id: "castelo", nome: "Castelo e magia", emoji: "🏰" },
  { id: "espaco", nome: "Espaço", emoji: "🚀" },
];

export const COR_CONTORNO = "#2E1408";

/** Formas -> markup, usado tanto no React quanto ao exportar o PNG. */
export function formaParaSvg(f: Forma): string {
  switch (f.t) {
    case "circulo":
      return `<circle cx="${f.cx}" cy="${f.cy}" r="${f.r}"/>`;
    case "elipse":
      return `<ellipse cx="${f.cx}" cy="${f.cy}" rx="${f.rx}" ry="${f.ry}"${
        f.giro ? ` transform="rotate(${f.giro} ${f.cx} ${f.cy})"` : ""
      }/>`;
    case "retangulo":
      return `<rect x="${f.x}" y="${f.y}" width="${f.l}" height="${f.a}"${
        f.raio ? ` rx="${f.raio}"` : ""
      }/>`;
    case "caminho":
      return `<path d="${f.d}"/>`;
  }
}

/**
 * SVG completo em texto, com as cores já aplicadas — é o que vai para o PNG
 * exportado (data URL, sem sair do aparelho).
 */
export function paginaParaSvg(pagina: Pagina, cores: Record<string, string>): string {
  const regioes = pagina.regioes
    .map(
      (r) =>
        `<g fill="${cores[r.id] ?? "#FFFFFF"}">${r.formas.map(formaParaSvg).join("")}</g>`,
    )
    .join("");
  const detalhes = (pagina.detalhes ?? [])
    .map(
      (d) =>
        `<g fill="${d.preenchimento ?? "none"}" stroke-width="${d.espessura ?? 3}">${d.formas
          .map(formaParaSvg)
          .join("")}</g>`,
    )
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${pagina.lado} ${pagina.lado}" width="${pagina.lado}" height="${pagina.lado}"><g stroke="${COR_CONTORNO}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round">${regioes}${detalhes}</g></svg>`;
}
