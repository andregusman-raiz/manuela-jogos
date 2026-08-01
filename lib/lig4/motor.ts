/**
 * Lig-4 — motor puro + IA (SPEC-jogos-tabuleiro §3, v1.1).
 * Grade [coluna][linha], linha 0 = FUNDO. IA com prioridade FECHADA pelo juiz:
 * vitória própria > bloqueio > (distração | minimax prof. 2). A distração
 * NUNCA pula as duas primeiras regras.
 */

export type JogadorLig4 = 0 | 1;
export const COLUNAS = 7;
export const LINHAS = 6;

export interface EstadoLig4 {
  grade: (JogadorLig4 | null)[][];
  vez: JogadorLig4;
  situacao: "jogando" | "fim";
  vencedor: JogadorLig4 | null; // null com situacao "fim" = empate
}

export function criarPartida(): EstadoLig4 {
  return {
    grade: Array.from({ length: COLUNAS }, () => Array<JogadorLig4 | null>(LINHAS).fill(null)),
    vez: 0,
    situacao: "jogando",
    vencedor: null,
  };
}

export function colunasLegais(estado: EstadoLig4): number[] {
  if (estado.situacao !== "jogando") return [];
  const legais: number[] = [];
  for (let c = 0; c < COLUNAS; c++) {
    if (estado.grade[c][LINHAS - 1] === null) legais.push(c);
  }
  return legais;
}

function linhaLivre(grade: EstadoLig4["grade"], coluna: number): number {
  return grade[coluna].findIndex((v) => v === null);
}

const DIRECOES: ReadonlyArray<readonly [number, number]> = [
  [1, 0], // horizontal
  [0, 1], // vertical
  [1, 1], // diagonal ↗
  [1, -1], // diagonal ↘
];

export function vencedorNaGrade(grade: EstadoLig4["grade"]): JogadorLig4 | null {
  for (let c = 0; c < COLUNAS; c++) {
    for (let l = 0; l < LINHAS; l++) {
      const dono = grade[c][l];
      if (dono === null) continue;
      for (const [dc, dl] of DIRECOES) {
        let n = 1;
        while (
          n < 4 &&
          c + dc * n < COLUNAS &&
          c + dc * n >= 0 &&
          l + dl * n < LINHAS &&
          l + dl * n >= 0 &&
          grade[c + dc * n][l + dl * n] === dono
        ) {
          n++;
        }
        if (n === 4) return dono;
      }
    }
  }
  return null;
}

export function jogar(estado: EstadoLig4, coluna: number): EstadoLig4 {
  if (estado.situacao !== "jogando") return estado;
  if (coluna < 0 || coluna >= COLUNAS) return estado;
  const linha = linhaLivre(estado.grade, coluna);
  if (linha === -1) return estado;
  const grade = estado.grade.map((col) => [...col]);
  grade[coluna][linha] = estado.vez;
  const vencedor = vencedorNaGrade(grade);
  const cheia = grade.every((col) => col[LINHAS - 1] !== null);
  if (vencedor !== null || cheia) {
    return { grade, vez: estado.vez, situacao: "fim", vencedor };
  }
  return { grade, vez: (1 - estado.vez) as JogadorLig4, situacao: "jogando", vencedor: null };
}

export function empate(estado: EstadoLig4): boolean {
  return estado.situacao === "fim" && estado.vencedor === null;
}

// ─── IA ────────────────────────────────────────────────────────────────────

function simular(grade: EstadoLig4["grade"], coluna: number, dono: JogadorLig4) {
  const nova = grade.map((col) => [...col]);
  nova[coluna][linhaLivre(grade, coluna)] = dono;
  return nova;
}

function ganhaJogando(grade: EstadoLig4["grade"], coluna: number, dono: JogadorLig4): boolean {
  if (linhaLivre(grade, coluna) === -1) return false;
  return vencedorNaGrade(simular(grade, coluna, dono)) === dono;
}

/** Janelas de 4: 3 minhas abertas +50, 2 +5; centro +3/peça — e o simétrico dele negativo. */
function avaliar(grade: EstadoLig4["grade"], eu: JogadorLig4): number {
  const ele = (1 - eu) as JogadorLig4;
  let nota = 0;
  for (let c = 0; c < COLUNAS; c++) {
    for (let l = 0; l < LINHAS; l++) {
      for (const [dc, dl] of DIRECOES) {
        if (c + dc * 3 >= COLUNAS || l + dl * 3 >= LINHAS || l + dl * 3 < 0) continue;
        let minhas = 0;
        let dele = 0;
        for (let n = 0; n < 4; n++) {
          const v = grade[c + dc * n][l + dl * n];
          if (v === eu) minhas++;
          else if (v === ele) dele++;
        }
        if (dele === 0) nota += minhas === 3 ? 50 : minhas === 2 ? 5 : 0;
        if (minhas === 0) nota -= dele === 3 ? 50 : dele === 2 ? 5 : 0;
      }
    }
  }
  for (let l = 0; l < LINHAS; l++) {
    if (grade[3][l] === eu) nota += 3;
    else if (grade[3][l] === ele) nota -= 3;
  }
  return nota;
}

/** Desempate determinístico: mais central primeiro, depois mais à esquerda. */
function ordenar(colunas: number[]): number[] {
  return [...colunas].sort((a, b) => Math.abs(a - 3) - Math.abs(b - 3) || a - b);
}

function notaMinimax(grade: EstadoLig4["grade"], coluna: number, eu: JogadorLig4): number {
  const ele = (1 - eu) as JogadorLig4;
  if (ganhaJogando(grade, coluna, eu)) return Infinity;
  const depois = simular(grade, coluna, eu);
  let pior = Infinity;
  let alguma = false;
  for (let d = 0; d < COLUNAS; d++) {
    if (linhaLivre(depois, d) === -1) continue;
    alguma = true;
    if (ganhaJogando(depois, d, ele)) {
      pior = Math.min(pior, -Infinity);
      continue;
    }
    pior = Math.min(pior, avaliar(simular(depois, d, ele), eu));
  }
  return alguma ? pior : avaliar(depois, eu);
}

function melhorPorMinimax(
  grade: EstadoLig4["grade"],
  colunas: number[],
  eu: JogadorLig4,
): number {
  let melhor = ordenar(colunas)[0];
  let melhorNota = -Infinity;
  for (const c of ordenar(colunas)) {
    const nota = notaMinimax(grade, c, eu);
    if (nota > melhorNota) {
      melhorNota = nota;
      melhor = c;
    }
  }
  return melhor;
}

/**
 * `sorte` devolve [0,1). Prioridade (SPEC §3.2): vitória em 1 (SEMPRE) →
 * bloqueio (SEMPRE; 2+ ameaças = a de melhor minimax) → distração (coluna
 * aleatória legal) → minimax profundidade 2.
 */
export function iaJogar(
  estado: EstadoLig4,
  sorte: () => number,
  distracao: number,
): number {
  const legais = colunasLegais(estado);
  const eu = estado.vez;
  const ele = (1 - eu) as JogadorLig4;

  for (const c of ordenar(legais)) {
    if (ganhaJogando(estado.grade, c, eu)) return c;
  }
  const ameacas = legais.filter((c) => ganhaJogando(estado.grade, c, ele));
  if (ameacas.length === 1) return ameacas[0];
  if (ameacas.length > 1) return melhorPorMinimax(estado.grade, ameacas, eu);

  if (sorte() < distracao) {
    return legais[Math.floor(sorte() * legais.length)];
  }
  return melhorPorMinimax(estado.grade, legais, eu);
}
