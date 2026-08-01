/**
 * Roda Romana (Rota) — motor puro (SPEC-jogos-tabuleiro §5, v1.1).
 * 8 casas no anel (0..7) + centro (8). 3 peças por jogador; colocação
 * alternada e depois movimento para casa vazia adjacente. Sem capturas.
 * Empate por repetição: a MESMA configuração (casas + vez) pela 3ª vez.
 */

export type JogadorRota = 0 | 1;

export interface EstadoRota {
  casas: (JogadorRota | null)[]; // 9 posições; 8 = centro
  vez: JogadorRota;
  situacao: "jogando" | "fim" | "empate";
  vencedor: JogadorRota | null;
  historico: Record<string, number>;
}

/** 12 linhas: 8 arcos de vizinhas no anel + 4 diâmetros pelo centro. */
export const LINHAS_ROTA: ReadonlyArray<readonly number[]> = [
  ...Array.from({ length: 8 }, (_, i) => [i, (i + 1) % 8, (i + 2) % 8]),
  ...Array.from({ length: 4 }, (_, i) => [i, 8, i + 4]),
];

export function adjacentes(casa: number): number[] {
  if (casa === 8) return [0, 1, 2, 3, 4, 5, 6, 7];
  return [(casa + 1) % 8, (casa + 7) % 8, 8];
}

export function faseDe(estado: EstadoRota): "colocacao" | "movimento" {
  return estado.casas.filter((c) => c !== null).length < 6 ? "colocacao" : "movimento";
}

function chave(casas: (JogadorRota | null)[], vez: JogadorRota): string {
  return casas.map((c) => (c === null ? "." : c)).join("") + vez;
}

export function criarPartida(): EstadoRota {
  const casas = Array<JogadorRota | null>(9).fill(null);
  return {
    casas,
    vez: 0,
    situacao: "jogando",
    vencedor: null,
    historico: { [chave(casas, 0)]: 1 },
  };
}

export function vencedorNaPosicao(casas: (JogadorRota | null)[]): JogadorRota | null {
  for (const linha of LINHAS_ROTA) {
    const dono = casas[linha[0]];
    if (dono !== null && linha.every((c) => casas[c] === dono)) return dono;
  }
  return null;
}

function depoisDaAcao(
  estado: EstadoRota,
  casas: (JogadorRota | null)[],
): EstadoRota {
  const ator = estado.vez;
  if (vencedorNaPosicao(casas) === ator) {
    return { ...estado, casas, situacao: "fim", vencedor: ator };
  }
  const proximaVez = (1 - ator) as JogadorRota;
  const k = chave(casas, proximaVez);
  const vezes = (estado.historico[k] ?? 0) + 1;
  const historico = { ...estado.historico, [k]: vezes };
  if (vezes >= 3) {
    return { ...estado, casas, vez: proximaVez, situacao: "empate", historico };
  }
  return { ...estado, casas, vez: proximaVez, situacao: "jogando", historico };
}

export function colocar(estado: EstadoRota, casa: number): EstadoRota {
  if (estado.situacao !== "jogando" || faseDe(estado) !== "colocacao") return estado;
  if (casa < 0 || casa > 8 || estado.casas[casa] !== null) return estado;
  const casas = [...estado.casas];
  casas[casa] = estado.vez;
  return depoisDaAcao(estado, casas);
}

export function moverPeca(estado: EstadoRota, de: number, para: number): EstadoRota {
  if (estado.situacao !== "jogando" || faseDe(estado) !== "movimento") return estado;
  if (estado.casas[de] !== estado.vez || estado.casas[para] !== null) return estado;
  if (!adjacentes(de).includes(para)) return estado;
  const casas = [...estado.casas];
  casas[de] = null;
  casas[para] = estado.vez;
  return depoisDaAcao(estado, casas);
}

export interface AcaoRota {
  tipo: "colocar" | "mover";
  casa?: number;
  de?: number;
  para?: number;
}

export function acoesLegais(estado: EstadoRota): AcaoRota[] {
  if (estado.situacao !== "jogando") return [];
  if (faseDe(estado) === "colocacao") {
    return estado.casas
      .map((c, i) => (c === null ? i : -1))
      .filter((i) => i >= 0)
      .map((casa) => ({ tipo: "colocar" as const, casa }));
  }
  const acoes: AcaoRota[] = [];
  estado.casas.forEach((dono, de) => {
    if (dono !== estado.vez) return;
    for (const para of adjacentes(de)) {
      if (estado.casas[para] === null) acoes.push({ tipo: "mover", de, para });
    }
  });
  return acoes;
}

export function aplicar(estado: EstadoRota, acao: AcaoRota): EstadoRota {
  return acao.tipo === "colocar"
    ? colocar(estado, acao.casa!)
    : moverPeca(estado, acao.de!, acao.para!);
}

/** Manu: vence em 1 se pode; senão bloqueia vitória iminente do humano;
 *  senão aleatória legal (sorte injetada). Determinística fora do 3º ramo. */
export function iaJogarRota(estado: EstadoRota, sorte: () => number): AcaoRota {
  const acoes = acoesLegais(estado);
  for (const acao of acoes) {
    const depois = aplicar(estado, acao);
    if (depois.situacao === "fim" && depois.vencedor === estado.vez) return acao;
  }
  const ele = (1 - estado.vez) as JogadorRota;
  const doInimigo = acoesLegais({ ...estado, vez: ele });
  for (const dele of doInimigo) {
    const depois = aplicar({ ...estado, vez: ele }, dele);
    if (depois.situacao === "fim" && depois.vencedor === ele) {
      const alvo = dele.tipo === "colocar" ? dele.casa! : dele.para!;
      const bloqueio = acoes.find(
        (a) => (a.tipo === "colocar" ? a.casa : a.para) === alvo,
      );
      if (bloqueio) return bloqueio;
    }
  }
  return acoes[Math.floor(sorte() * acoes.length)];
}
