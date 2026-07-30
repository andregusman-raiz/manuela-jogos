import type { Pagina } from "./tipos";

/**
 * As páginas do livro de colorir. Arte original, desenhada em geometria sobre um
 * quadrado de 200x200.
 *
 * Regras de composição que valem para todas:
 *  - a região que fica ATRÁS vem primeiro na lista (a de trás é desenhada antes);
 *  - toda área grande o suficiente para um dedo de criança é pintável;
 *  - olho, boca e bigode são detalhe fixo: pintar por cima do olho estraga o
 *    desenho e frustra.
 */
export const PAGINAS: Pagina[] = [
  // --------------------------------------------------------------- animais
  {
    slug: "gato",
    nome: "Gatinho",
    emoji: "🐱",
    categoria: "animais",
    lado: 200,
    regioes: [
      {
        id: "cauda",
        nome: "cauda",
        formas: [
          {
            t: "caminho",
            d: "M148 150 C178 148 188 118 176 94 C168 88 158 94 162 108 C170 132 156 140 142 138 Z",
          },
        ],
      },
      { id: "orelha-esq", nome: "orelha esquerda", formas: [{ t: "caminho", d: "M70 48 L58 12 L98 32 Z" }] },
      { id: "orelha-dir", nome: "orelha direita", formas: [{ t: "caminho", d: "M130 48 L142 12 L102 32 Z" }] },
      { id: "corpo", nome: "corpo", formas: [{ t: "elipse", cx: 100, cy: 140, rx: 54, ry: 46 }] },
      { id: "pata-esq", nome: "pata esquerda", formas: [{ t: "elipse", cx: 74, cy: 180, rx: 19, ry: 12 }] },
      { id: "pata-dir", nome: "pata direita", formas: [{ t: "elipse", cx: 126, cy: 180, rx: 19, ry: 12 }] },
      { id: "barriga", nome: "barriga", formas: [{ t: "elipse", cx: 100, cy: 152, rx: 30, ry: 30 }] },
      { id: "cabeca", nome: "cabeça", formas: [{ t: "circulo", cx: 100, cy: 78, r: 44 }] },
    ],
    detalhes: [
      {
        preenchimento: "#2E1408",
        formas: [
          { t: "circulo", cx: 86, cy: 74, r: 5 },
          { t: "circulo", cx: 114, cy: 74, r: 5 },
          { t: "caminho", d: "M95 90 L105 90 L100 97 Z" },
        ],
      },
      {
        espessura: 2.5,
        formas: [
          { t: "caminho", d: "M100 97 C100 105 92 107 88 101" },
          { t: "caminho", d: "M100 97 C100 105 108 107 112 101" },
          { t: "caminho", d: "M60 82 L34 76" },
          { t: "caminho", d: "M60 90 L34 92" },
          { t: "caminho", d: "M140 82 L166 76" },
          { t: "caminho", d: "M140 90 L166 92" },
        ],
      },
    ],
  },
  {
    slug: "cachorro",
    nome: "Cachorrinho",
    emoji: "🐶",
    categoria: "animais",
    lado: 200,
    regioes: [
      {
        id: "cauda",
        nome: "cauda",
        formas: [
          {
            t: "caminho",
            d: "M150 128 C172 120 180 96 168 84 C158 80 150 88 155 98 C160 112 150 118 144 120 Z",
          },
        ],
      },
      { id: "orelha-esq", nome: "orelha esquerda", formas: [{ t: "elipse", cx: 58, cy: 78, rx: 16, ry: 31, giro: -14 }] },
      { id: "orelha-dir", nome: "orelha direita", formas: [{ t: "elipse", cx: 142, cy: 78, rx: 16, ry: 31, giro: 14 }] },
      { id: "corpo", nome: "corpo", formas: [{ t: "elipse", cx: 100, cy: 140, rx: 52, ry: 42 }] },
      { id: "pata-esq", nome: "pata esquerda", formas: [{ t: "retangulo", x: 70, y: 162, l: 22, a: 30, raio: 11 }] },
      { id: "pata-dir", nome: "pata direita", formas: [{ t: "retangulo", x: 108, y: 162, l: 22, a: 30, raio: 11 }] },
      { id: "cabeca", nome: "cabeça", formas: [{ t: "circulo", cx: 100, cy: 72, r: 42 }] },
      { id: "focinho", nome: "focinho", formas: [{ t: "elipse", cx: 100, cy: 92, rx: 25, ry: 18 }] },
      // coleira abaixo da cabeça (que termina em y=114), senão invade o focinho
      { id: "coleira", nome: "coleira", formas: [{ t: "retangulo", x: 78, y: 116, l: 44, a: 13, raio: 6 }] },
    ],
    detalhes: [
      {
        preenchimento: "#2E1408",
        formas: [
          { t: "circulo", cx: 86, cy: 64, r: 5 },
          { t: "circulo", cx: 114, cy: 64, r: 5 },
          { t: "elipse", cx: 100, cy: 84, rx: 8, ry: 6 },
        ],
      },
      {
        espessura: 2.5,
        formas: [
          { t: "caminho", d: "M100 90 L100 97" },
          { t: "caminho", d: "M100 97 C94 103 88 100 88 95" },
          { t: "caminho", d: "M100 97 C106 103 112 100 112 95" },
        ],
      },
    ],
  },
  {
    slug: "coelho",
    nome: "Coelhinho",
    emoji: "🐰",
    categoria: "animais",
    lado: 200,
    regioes: [
      { id: "orelha-esq", nome: "orelha esquerda", formas: [{ t: "elipse", cx: 82, cy: 36, rx: 13, ry: 32, giro: -8 }] },
      { id: "orelha-dir", nome: "orelha direita", formas: [{ t: "elipse", cx: 118, cy: 36, rx: 13, ry: 32, giro: 8 }] },
      { id: "rabo", nome: "rabinho", formas: [{ t: "circulo", cx: 152, cy: 150, r: 15 }] },
      { id: "corpo", nome: "corpo", formas: [{ t: "elipse", cx: 100, cy: 138, rx: 44, ry: 48 }] },
      { id: "pata-esq", nome: "pata esquerda", formas: [{ t: "elipse", cx: 78, cy: 180, rx: 20, ry: 12 }] },
      { id: "pata-dir", nome: "pata direita", formas: [{ t: "elipse", cx: 122, cy: 180, rx: 20, ry: 12 }] },
      { id: "barriga", nome: "barriga", formas: [{ t: "elipse", cx: 100, cy: 146, rx: 26, ry: 32 }] },
      { id: "cabeca", nome: "cabeça", formas: [{ t: "circulo", cx: 100, cy: 84, r: 38 }] },
    ],
    detalhes: [
      {
        preenchimento: "#2E1408",
        formas: [
          { t: "circulo", cx: 88, cy: 80, r: 5 },
          { t: "circulo", cx: 112, cy: 80, r: 5 },
          { t: "caminho", d: "M95 92 L105 92 L100 98 Z" },
        ],
      },
      {
        espessura: 2.5,
        formas: [
          { t: "caminho", d: "M100 98 L100 103" },
          { t: "caminho", d: "M100 103 C95 108 90 105 90 101" },
          { t: "caminho", d: "M100 103 C105 108 110 105 110 101" },
          { t: "caminho", d: "M66 96 L44 92" },
          { t: "caminho", d: "M66 103 L44 107" },
          { t: "caminho", d: "M134 96 L156 92" },
          { t: "caminho", d: "M134 103 L156 107" },
        ],
      },
    ],
  },

  // ----------------------------------------------------------- dinossauros
  {
    slug: "brontossauro",
    nome: "Pescoção",
    emoji: "🦕",
    categoria: "dinossauros",
    lado: 200,
    regioes: [
      {
        id: "cauda",
        nome: "cauda",
        formas: [
          {
            t: "caminho",
            d: "M62 140 C32 138 16 122 10 104 C22 98 36 110 44 120 C52 130 60 132 68 132 Z",
          },
        ],
      },
      {
        id: "pescoco",
        nome: "pescoço",
        formas: [
          {
            t: "caminho",
            d: "M130 112 C130 72 140 40 158 28 C170 22 180 34 172 44 C156 58 152 84 154 114 Z",
          },
        ],
      },
      { id: "cabeca", nome: "cabeça", formas: [{ t: "elipse", cx: 170, cy: 30, rx: 22, ry: 17 }] },
      { id: "corpo", nome: "corpo", formas: [{ t: "elipse", cx: 102, cy: 132, rx: 54, ry: 38 }] },
      { id: "barriga", nome: "barriga", formas: [{ t: "elipse", cx: 102, cy: 148, rx: 34, ry: 20 }] },
      { id: "pata-1", nome: "pata da frente", formas: [{ t: "retangulo", x: 74, y: 160, l: 22, a: 32, raio: 9 }] },
      { id: "pata-2", nome: "pata do meio", formas: [{ t: "retangulo", x: 104, y: 160, l: 22, a: 32, raio: 9 }] },
      { id: "pata-3", nome: "pata de trás", formas: [{ t: "retangulo", x: 134, y: 156, l: 20, a: 30, raio: 9 }] },
    ],
    detalhes: [
      { preenchimento: "#2E1408", formas: [{ t: "circulo", cx: 177, cy: 26, r: 4 }] },
      { espessura: 2.5, formas: [{ t: "caminho", d: "M186 36 C180 40 172 40 166 38" }] },
    ],
  },
  {
    slug: "estegossauro",
    nome: "Placas",
    emoji: "🦖",
    categoria: "dinossauros",
    lado: 200,
    regioes: [
      {
        id: "cauda",
        nome: "cauda",
        formas: [
          {
            t: "caminho",
            d: "M54 136 C30 134 14 120 8 104 C20 98 34 108 42 118 C50 128 56 130 62 130 Z",
          },
        ],
      },
      { id: "placa-1", nome: "placa de trás", formas: [{ t: "caminho", d: "M72 102 L82 70 L96 102 Z" }] },
      { id: "placa-2", nome: "placa do meio", formas: [{ t: "caminho", d: "M98 98 L110 62 L124 98 Z" }] },
      { id: "placa-3", nome: "placa da frente", formas: [{ t: "caminho", d: "M126 102 L138 74 L148 104 Z" }] },
      { id: "corpo", nome: "corpo", formas: [{ t: "elipse", cx: 102, cy: 134, rx: 56, ry: 36 }] },
      { id: "cabeca", nome: "cabeça", formas: [{ t: "elipse", cx: 168, cy: 126, rx: 24, ry: 18 }] },
      { id: "barriga", nome: "barriga", formas: [{ t: "elipse", cx: 102, cy: 150, rx: 36, ry: 18 }] },
      { id: "pata-1", nome: "pata de trás", formas: [{ t: "retangulo", x: 74, y: 162, l: 21, a: 30, raio: 9 }] },
      { id: "pata-2", nome: "pata do meio", formas: [{ t: "retangulo", x: 104, y: 162, l: 21, a: 30, raio: 9 }] },
      { id: "pata-3", nome: "pata da frente", formas: [{ t: "retangulo", x: 132, y: 158, l: 19, a: 28, raio: 9 }] },
    ],
    detalhes: [
      { preenchimento: "#2E1408", formas: [{ t: "circulo", cx: 176, cy: 120, r: 4 }] },
      { espessura: 2.5, formas: [{ t: "caminho", d: "M186 132 C180 136 172 136 166 134" }] },
    ],
  },
  {
    slug: "ovo-dino",
    nome: "Dino bebê",
    emoji: "🥚",
    categoria: "dinossauros",
    lado: 200,
    regioes: [
      { id: "bebe", nome: "dinossauro bebê", formas: [{ t: "circulo", cx: 100, cy: 104, r: 32 }] },
      {
        id: "ovo",
        nome: "ovo",
        formas: [{ t: "caminho", d: "M58 186 C50 152 64 126 100 126 C136 126 150 152 142 186 Z" }],
      },
      { id: "braco-esq", nome: "bracinho esquerdo", formas: [{ t: "elipse", cx: 64, cy: 140, rx: 15, ry: 11 }] },
      { id: "braco-dir", nome: "bracinho direito", formas: [{ t: "elipse", cx: 136, cy: 140, rx: 15, ry: 11 }] },
      {
        id: "casca",
        nome: "casquinha na cabeça",
        formas: [
          {
            t: "caminho",
            d: "M72 92 C76 66 124 66 128 92 L118 84 L109 94 L100 82 L91 94 L82 84 Z",
          },
        ],
      },
    ],
    detalhes: [
      {
        preenchimento: "#2E1408",
        formas: [
          { t: "circulo", cx: 89, cy: 106, r: 5 },
          { t: "circulo", cx: 111, cy: 106, r: 5 },
        ],
      },
      {
        espessura: 2.5,
        formas: [
          { t: "caminho", d: "M92 118 C96 124 104 124 108 118" },
          { t: "caminho", d: "M62 148 L76 140 L92 150 L108 138 L124 150 L138 142" },
        ],
      },
    ],
  },

  // --------------------------------------------------------------- castelo
  {
    slug: "castelo",
    nome: "Castelo",
    emoji: "🏰",
    categoria: "castelo",
    lado: 200,
    regioes: [
      { id: "bandeira", nome: "bandeira", formas: [{ t: "caminho", d: "M150 44 L150 20 L182 30 L150 40 Z" }] },
      { id: "telhado-esq", nome: "telhado esquerdo", formas: [{ t: "caminho", d: "M24 92 L50 44 L76 92 Z" }] },
      { id: "telhado-dir", nome: "telhado direito", formas: [{ t: "caminho", d: "M124 92 L150 44 L176 92 Z" }] },
      { id: "telhado-meio", nome: "telhado do meio", formas: [{ t: "caminho", d: "M60 112 L100 68 L140 112 Z" }] },
      { id: "torre-esq", nome: "torre esquerda", formas: [{ t: "retangulo", x: 30, y: 90, l: 40, a: 92 }] },
      { id: "torre-dir", nome: "torre direita", formas: [{ t: "retangulo", x: 130, y: 90, l: 40, a: 92 }] },
      { id: "meio", nome: "parte do meio", formas: [{ t: "retangulo", x: 66, y: 110, l: 68, a: 72 }] },
      {
        id: "portao",
        nome: "portão",
        formas: [{ t: "caminho", d: "M82 182 L82 148 C82 132 118 132 118 148 L118 182 Z" }],
      },
      {
        id: "janelas",
        nome: "janelas",
        formas: [
          { t: "circulo", cx: 50, cy: 116, r: 9 },
          { t: "circulo", cx: 150, cy: 116, r: 9 },
          { t: "circulo", cx: 100, cy: 126, r: 9 },
        ],
      },
      { id: "chao", nome: "chão", formas: [{ t: "retangulo", x: 8, y: 182, l: 184, a: 14, raio: 7 }] },
    ],
    detalhes: [
      {
        espessura: 2.5,
        formas: [
          { t: "caminho", d: "M150 44 L150 18" },
          { t: "caminho", d: "M100 148 L100 182" },
        ],
      },
    ],
  },
  {
    slug: "coroa",
    nome: "Coroa",
    emoji: "👑",
    categoria: "castelo",
    lado: 200,
    regioes: [
      {
        id: "coroa",
        nome: "coroa",
        formas: [
          {
            t: "caminho",
            d: "M38 152 L38 96 L62 122 L82 74 L100 118 L118 74 L138 122 L162 96 L162 152 Z",
          },
        ],
      },
      { id: "base", nome: "faixa", formas: [{ t: "retangulo", x: 34, y: 150, l: 132, a: 26, raio: 9 }] },
      {
        id: "pontas",
        nome: "bolinhas das pontas",
        formas: [
          { t: "circulo", cx: 38, cy: 92, r: 8 },
          { t: "circulo", cx: 82, cy: 70, r: 8 },
          { t: "circulo", cx: 118, cy: 70, r: 8 },
          { t: "circulo", cx: 162, cy: 92, r: 8 },
        ],
      },
      { id: "joia-1", nome: "joia da esquerda", formas: [{ t: "circulo", cx: 62, cy: 163, r: 9 }] },
      { id: "joia-2", nome: "joia do meio", formas: [{ t: "circulo", cx: 100, cy: 163, r: 9 }] },
      { id: "joia-3", nome: "joia da direita", formas: [{ t: "circulo", cx: 138, cy: 163, r: 9 }] },
    ],
    detalhes: [
      {
        espessura: 2.5,
        formas: [
          { t: "caminho", d: "M100 34 L100 48" },
          { t: "caminho", d: "M82 42 L90 50" },
          { t: "caminho", d: "M118 42 L110 50" },
        ],
      },
    ],
  },
  {
    slug: "unicornio",
    nome: "Unicórnio",
    emoji: "🦄",
    categoria: "castelo",
    lado: 200,
    regioes: [
      {
        id: "crina",
        nome: "crina",
        formas: [
          {
            t: "caminho",
            d: "M120 66 C152 54 172 78 158 100 C174 112 166 138 146 138 C152 158 132 172 114 160 Z",
          },
        ],
      },
      { id: "chifre", nome: "chifre", formas: [{ t: "caminho", d: "M106 64 L120 12 L134 62 Z" }] },
      { id: "orelha", nome: "orelha", formas: [{ t: "caminho", d: "M86 68 L76 34 L106 58 Z" }] },
      { id: "cabeca", nome: "cabeça", formas: [{ t: "elipse", cx: 104, cy: 110, rx: 46, ry: 44 }] },
      { id: "focinho", nome: "focinho", formas: [{ t: "elipse", cx: 64, cy: 128, rx: 25, ry: 20 }] },
    ],
    detalhes: [
      {
        preenchimento: "#2E1408",
        formas: [
          { t: "circulo", cx: 96, cy: 104, r: 5 },
          { t: "elipse", cx: 52, cy: 126, rx: 4, ry: 3 },
        ],
      },
      {
        espessura: 2.5,
        formas: [
          { t: "caminho", d: "M50 138 C58 143 68 141 72 136" },
          { t: "caminho", d: "M112 32 L127 38" },
          { t: "caminho", d: "M109 46 L130 51" },
        ],
      },
    ],
  },

  // ---------------------------------------------------------------- espaço
  {
    slug: "foguete",
    nome: "Foguete",
    emoji: "🚀",
    categoria: "espaco",
    lado: 200,
    regioes: [
      {
        id: "fogo",
        nome: "fogo",
        formas: [
          { t: "caminho", d: "M78 146 C86 172 94 182 100 194 C106 182 114 172 122 146 Z" },
        ],
      },
      { id: "aleta-esq", nome: "asa esquerda", formas: [{ t: "caminho", d: "M66 96 L32 142 L66 142 Z" }] },
      { id: "aleta-dir", nome: "asa direita", formas: [{ t: "caminho", d: "M134 96 L168 142 L134 142 Z" }] },
      {
        id: "corpo",
        nome: "foguete",
        formas: [
          { t: "caminho", d: "M100 12 C126 44 134 84 134 128 L66 128 C66 84 74 44 100 12 Z" },
        ],
      },
      { id: "base", nome: "base", formas: [{ t: "retangulo", x: 64, y: 126, l: 72, a: 20, raio: 7 }] },
      { id: "janela", nome: "janela", formas: [{ t: "circulo", cx: 100, cy: 68, r: 22 }] },
      { id: "bico", nome: "pontinha", formas: [{ t: "circulo", cx: 100, cy: 20, r: 8 }] },
    ],
    detalhes: [
      { espessura: 2.5, formas: [{ t: "circulo", cx: 100, cy: 68, r: 14 }] },
    ],
  },
  {
    slug: "planeta",
    nome: "Planeta",
    emoji: "🪐",
    categoria: "espaco",
    lado: 200,
    regioes: [
      { id: "anel", nome: "anel", formas: [{ t: "elipse", cx: 100, cy: 110, rx: 90, ry: 22, giro: -18 }] },
      { id: "planeta", nome: "planeta", formas: [{ t: "circulo", cx: 100, cy: 104, r: 58 }] },
      { id: "cratera-1", nome: "cratera grande", formas: [{ t: "circulo", cx: 118, cy: 124, r: 17 }] },
      { id: "cratera-2", nome: "cratera média", formas: [{ t: "circulo", cx: 76, cy: 84, r: 13 }] },
      { id: "cratera-3", nome: "cratera pequena", formas: [{ t: "circulo", cx: 124, cy: 74, r: 9 }] },
      {
        id: "estrelas",
        nome: "estrelas",
        formas: [
          { t: "caminho", d: "M26 24 L30 34 L40 36 L30 40 L26 50 L22 40 L12 36 L22 34 Z" },
          { t: "caminho", d: "M174 44 L178 54 L188 56 L178 60 L174 70 L170 60 L160 56 L170 54 Z" },
          { t: "caminho", d: "M44 164 L47 172 L55 174 L47 177 L44 185 L41 177 L33 174 L41 172 Z" },
        ],
      },
    ],
  },
  {
    slug: "astronauta",
    nome: "Astronauta",
    emoji: "👩‍🚀",
    categoria: "espaco",
    lado: 200,
    regioes: [
      { id: "mochila", nome: "mochila", formas: [{ t: "retangulo", x: 60, y: 90, l: 80, a: 56, raio: 14 }] },
      { id: "braco-esq", nome: "braço esquerdo", formas: [{ t: "retangulo", x: 30, y: 100, l: 36, a: 24, raio: 12 }] },
      { id: "braco-dir", nome: "braço direito", formas: [{ t: "retangulo", x: 134, y: 100, l: 36, a: 24, raio: 12 }] },
      { id: "perna-esq", nome: "perna esquerda", formas: [{ t: "retangulo", x: 72, y: 150, l: 24, a: 38, raio: 11 }] },
      { id: "perna-dir", nome: "perna direita", formas: [{ t: "retangulo", x: 104, y: 150, l: 24, a: 38, raio: 11 }] },
      { id: "corpo", nome: "traje", formas: [{ t: "retangulo", x: 66, y: 92, l: 68, a: 64, raio: 20 }] },
      { id: "capacete", nome: "capacete", formas: [{ t: "circulo", cx: 100, cy: 60, r: 42 }] },
      { id: "visor", nome: "visor", formas: [{ t: "elipse", cx: 100, cy: 58, rx: 27, ry: 21 }] },
    ],
    detalhes: [
      {
        preenchimento: "#2E1408",
        formas: [
          { t: "circulo", cx: 86, cy: 114, r: 4 },
          { t: "circulo", cx: 100, cy: 114, r: 4 },
          { t: "circulo", cx: 114, cy: 114, r: 4 },
        ],
      },
      { espessura: 2.5, formas: [{ t: "caminho", d: "M84 50 C88 44 98 41 105 43" }] },
    ],
  },
];

export function paginasDaCategoria(categoria: string): Pagina[] {
  return PAGINAS.filter((p) => p.categoria === categoria);
}

export function buscarPagina(slug: string | undefined): Pagina | undefined {
  if (!slug) return undefined;
  return PAGINAS.find((p) => p.slug === slug);
}
