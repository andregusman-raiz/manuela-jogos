/**
 * Mancala/Kalah 6×4 — motor puro (SPEC-jogos-tabuleiro §4, v1.1).
 * covas[lado][i]: i cresce EM DIREÇÃO ao kalah do lado. Oposta de (L,i) é
 * (1-L, 5-i). Semeadura anti-horária inclui o próprio kalah e PULA o do
 * adversário. FIM DOMINA a jogada extra (blocker J8 do juiz).
 */

export type LadoMancala = 0 | 1;

export interface EstadoMancala {
  covas: [number[], number[]];
  kalahs: [number, number];
  vez: LadoMancala;
  situacao: "jogando" | "fim";
  vencedor: LadoMancala | null; // null + fim = empate 24×24
}

export const SEMENTES_INICIAIS = 4;

export function criarPartida(): EstadoMancala {
  return {
    covas: [Array(6).fill(SEMENTES_INICIAIS), Array(6).fill(SEMENTES_INICIAIS)],
    kalahs: [0, 0],
    vez: 0,
    situacao: "jogando",
    vencedor: null,
  };
}

export function covasLegais(estado: EstadoMancala): number[] {
  if (estado.situacao !== "jogando") return [];
  return estado.covas[estado.vez]
    .map((s, i) => (s > 0 ? i : -1))
    .filter((i) => i >= 0);
}

export function semear(estado: EstadoMancala, cova: number): EstadoMancala {
  if (estado.situacao !== "jogando") return estado;
  if (cova < 0 || cova > 5) return estado;
  const eu = estado.vez;
  const ele = (1 - eu) as LadoMancala;
  let sementes = estado.covas[eu][cova];
  if (sementes === 0) return estado;

  const covas: [number[], number[]] = [[...estado.covas[0]], [...estado.covas[1]]];
  const kalahs: [number, number] = [...estado.kalahs];
  covas[eu][cova] = 0;

  // anel de 13 posições na perspectiva de quem semeia: 0..5 = minhas covas,
  // 6 = meu kalah, 7..12 = covas dele. O kalah DELE não existe no anel —
  // pular é automático, inclusive em voltas múltiplas.
  let pos = cova;
  while (sementes > 0) {
    pos = (pos + 1) % 13;
    if (pos === 6) kalahs[eu]++;
    else if (pos < 6) covas[eu][pos]++;
    else covas[ele][pos - 7]++;
    sementes--;
  }

  const terminouNoKalah = pos === 6;

  // captura: última em cova PRÓPRIA que estava vazia (agora 1) e oposta ≥1
  if (
    !terminouNoKalah &&
    pos < 6 &&
    covas[eu][pos] === 1 &&
    covas[ele][5 - pos] > 0
  ) {
    kalahs[eu] += covas[eu][pos] + covas[ele][5 - pos];
    covas[eu][pos] = 0;
    covas[ele][5 - pos] = 0;
  }

  // FIM domina extra: se um lado esvaziou, o outro varre e acabou
  const ladoVazio = ([0, 1] as const).find((l) => covas[l].every((s) => s === 0));
  if (ladoVazio !== undefined) {
    const outro = (1 - ladoVazio) as LadoMancala;
    kalahs[outro] += covas[outro].reduce((a, b) => a + b, 0);
    covas[outro] = Array(6).fill(0);
    const vencedor =
      kalahs[0] > kalahs[1] ? 0 : kalahs[1] > kalahs[0] ? 1 : null;
    return { covas, kalahs, vez: eu, situacao: "fim", vencedor };
  }

  return {
    covas,
    kalahs,
    vez: terminouNoKalah ? eu : ele,
    situacao: "jogando",
    vencedor: null,
  };
}

/** Greedy determinística (SPEC §4.1): maior ganho no próprio kalah;
 *  desempate: jogada extra > cova mais à direita (índice maior). */
export function iaEscolher(estado: EstadoMancala): number {
  const legais = covasLegais(estado);
  let melhor = legais[0];
  let melhorGanho = -1;
  let melhorExtra = false;
  for (const cova of legais) {
    const depois = semear(estado, cova);
    const ganho = depois.kalahs[estado.vez] - estado.kalahs[estado.vez];
    const extra = depois.situacao === "jogando" && depois.vez === estado.vez;
    const ganha =
      ganho > melhorGanho ||
      (ganho === melhorGanho && extra && !melhorExtra) ||
      (ganho === melhorGanho && extra === melhorExtra && cova > melhor);
    if (ganha) {
      melhor = cova;
      melhorGanho = ganho;
      melhorExtra = extra;
    }
  }
  return melhor;
}
