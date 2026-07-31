/**
 * Motor das Damas — SPEC onda 3 §3.4, lógica pura e imutável.
 * REGRAS DA CASA (simplificadas para 6-10, mostradas na tela de início):
 * captura por pulo em qualquer diagonal (frente/trás), encadeável, NÃO
 * obrigatória; dama anda/captura 1 casa em qualquer diagonal (não voadora);
 * PROMOÇÃO ENCERRA A JOGADA imediatamente; sem movimento legal = perdeu.
 */

export type Cor = "rosa" | "azul";
export type Casa = { linha: number; coluna: number };
export type Peca = { cor: Cor; dama: boolean };
export type Tabuleiro = (Peca | null)[][];

export type EstadoDamas = {
  tabuleiro: Tabuleiro;
  vez: Cor;
  /** casa da peça no meio de uma cadeia de captura (só ela pode seguir). */
  cadeia: Casa | null;
  vencedor: Cor | null;
};

export type Movimento = { de: Casa; para: Casa; captura?: Casa };

export const TAMANHO = 8;

const DIAGONAIS: Array<[number, number]> = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
];

function dentro(linha: number, coluna: number): boolean {
  return linha >= 0 && linha < TAMANHO && coluna >= 0 && coluna < TAMANHO;
}

function casaEscura(linha: number, coluna: number): boolean {
  return (linha + coluna) % 2 === 1;
}

export function estadoInicial(): EstadoDamas {
  const tabuleiro: Tabuleiro = Array.from({ length: TAMANHO }, () =>
    new Array<Peca | null>(TAMANHO).fill(null),
  );
  for (let linha = 0; linha < 3; linha++) {
    for (let coluna = 0; coluna < TAMANHO; coluna++) {
      if (casaEscura(linha, coluna)) tabuleiro[linha][coluna] = { cor: "azul", dama: false };
    }
  }
  for (let linha = 5; linha < 8; linha++) {
    for (let coluna = 0; coluna < TAMANHO; coluna++) {
      if (casaEscura(linha, coluna)) tabuleiro[linha][coluna] = { cor: "rosa", dama: false };
    }
  }
  return { tabuleiro, vez: "rosa", cadeia: null, vencedor: null };
}

export function contar(estado: EstadoDamas, cor: Cor): number {
  let total = 0;
  for (const linha of estado.tabuleiro) {
    for (const peca of linha) if (peca?.cor === cor) total++;
  }
  return total;
}

/** Direções de ANDAR: comum só para frente; dama qualquer diagonal. */
function direcoesDeAndar(peca: Peca): Array<[number, number]> {
  if (peca.dama) return DIAGONAIS;
  return peca.cor === "rosa"
    ? [
        [-1, -1],
        [-1, 1],
      ]
    : [
        [1, -1],
        [1, 1],
      ];
}

export function movimentosLegais(estado: EstadoDamas, casa: Casa): Movimento[] {
  if (estado.vencedor) return [];
  const peca = estado.tabuleiro[casa.linha]?.[casa.coluna];
  if (!peca || peca.cor !== estado.vez) return [];
  // em cadeia, só a peça da cadeia joga — e só captura
  if (estado.cadeia && (estado.cadeia.linha !== casa.linha || estado.cadeia.coluna !== casa.coluna)) {
    return [];
  }

  const movimentos: Movimento[] = [];
  // capturas: qualquer diagonal (regra da casa), comum ou dama
  for (const [dl, dc] of DIAGONAIS) {
    const meioL = casa.linha + dl;
    const meioC = casa.coluna + dc;
    const fimL = casa.linha + 2 * dl;
    const fimC = casa.coluna + 2 * dc;
    if (!dentro(fimL, fimC)) continue;
    const meio = estado.tabuleiro[meioL][meioC];
    if (meio && meio.cor !== peca.cor && !estado.tabuleiro[fimL][fimC]) {
      movimentos.push({
        de: casa,
        para: { linha: fimL, coluna: fimC },
        captura: { linha: meioL, coluna: meioC },
      });
    }
  }
  if (estado.cadeia) return movimentos;

  for (const [dl, dc] of direcoesDeAndar(peca)) {
    const l = casa.linha + dl;
    const c = casa.coluna + dc;
    if (dentro(l, c) && !estado.tabuleiro[l][c]) {
      movimentos.push({ de: casa, para: { linha: l, coluna: c } });
    }
  }
  return movimentos;
}

export function temMovimento(estado: EstadoDamas, cor: Cor): boolean {
  const sonda: EstadoDamas = { ...estado, vez: cor, cadeia: null, vencedor: null };
  for (let linha = 0; linha < TAMANHO; linha++) {
    for (let coluna = 0; coluna < TAMANHO; coluna++) {
      if (
        estado.tabuleiro[linha][coluna]?.cor === cor &&
        movimentosLegais(sonda, { linha, coluna }).length > 0
      ) {
        return true;
      }
    }
  }
  return false;
}

function clonar(tabuleiro: Tabuleiro): Tabuleiro {
  return tabuleiro.map((linha) => [...linha]);
}

/** Aplica um movimento LEGAL; movimento ilegal devolve a MESMA referência. */
export function mover(estado: EstadoDamas, movimento: Movimento): EstadoDamas {
  const legais = movimentosLegais(estado, movimento.de);
  const legal = legais.find(
    (m) =>
      m.para.linha === movimento.para.linha &&
      m.para.coluna === movimento.para.coluna &&
      Boolean(m.captura) === Boolean(movimento.captura),
  );
  if (!legal) return estado;

  const tabuleiro = clonar(estado.tabuleiro);
  const peca = tabuleiro[legal.de.linha][legal.de.coluna]!;
  tabuleiro[legal.de.linha][legal.de.coluna] = null;
  if (legal.captura) tabuleiro[legal.captura.linha][legal.captura.coluna] = null;

  const promoveu =
    !peca.dama &&
    ((peca.cor === "rosa" && legal.para.linha === 0) ||
      (peca.cor === "azul" && legal.para.linha === TAMANHO - 1));
  const novaPeca: Peca = promoveu ? { ...peca, dama: true } : peca;
  tabuleiro[legal.para.linha][legal.para.coluna] = novaPeca;

  const adversario: Cor = peca.cor === "rosa" ? "azul" : "rosa";
  let proximo: EstadoDamas = { tabuleiro, vez: adversario, cadeia: null, vencedor: null };

  // cadeia: capturou, NÃO promoveu (promoção encerra a jogada — regra da
  // casa fechada no juízo) e a mesma peça ainda tem pulo disponível
  if (legal.captura && !promoveu) {
    const sonda: EstadoDamas = { tabuleiro, vez: peca.cor, cadeia: legal.para, vencedor: null };
    if (movimentosLegais(sonda, legal.para).length > 0) {
      proximo = sonda;
    }
  }

  // fim: adversário sem peças ou sem movimento (quando a vez passa a ele)
  if (proximo.vez === adversario) {
    if (contar(proximo, adversario) === 0 || !temMovimento(proximo, adversario)) {
      proximo = { ...proximo, vencedor: peca.cor };
    }
  }
  return proximo;
}

/** Botão "parar aqui": encerra a cadeia voluntariamente (capturas não obrigatórias). */
export function pararCadeia(estado: EstadoDamas): EstadoDamas {
  if (!estado.cadeia) return estado;
  const adversario: Cor = estado.vez === "rosa" ? "azul" : "rosa";
  let proximo: EstadoDamas = { ...estado, vez: adversario, cadeia: null };
  if (contar(proximo, adversario) === 0 || !temMovimento(proximo, adversario)) {
    proximo = { ...proximo, vencedor: estado.vez };
  }
  return proximo;
}
