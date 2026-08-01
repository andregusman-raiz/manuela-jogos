/**
 * Cobras e Escadas — motor puro (SPEC-jogos-tabuleiro §2, v1.1).
 * Trilha 1..100 boustrophedon; dado SEMPRE injetado; quique no 100 e o
 * atalho aplica DEPOIS do quique. Corrida pura: sem decisões, a vez circula.
 */

export type DadoCobras = 1 | 2 | 3 | 4 | 5 | 6;

/** Atalhos fixos da SPEC — grafo sem encadeamento (conferido pelo juiz). */
export const ESCADAS: Readonly<Record<number, number>> = {
  4: 25,
  13: 46,
  33: 49,
  42: 63,
  50: 69,
  62: 81,
  74: 92,
};

export const COBRAS: Readonly<Record<number, number>> = {
  27: 5,
  40: 3,
  43: 18,
  54: 31,
  66: 45,
  76: 58,
  89: 53,
  99: 41,
};

export interface JogadaCobras {
  destino: number;
  /** Casas visitadas na ordem (para a animação casa a casa), SEM o atalho. */
  caminho: number[];
  atalho: "cobra" | "escada" | null;
}

export interface EstadoCobras {
  jogadores: number;
  posicoes: number[]; // casa 0 = fora do tabuleiro
  vez: number;
  dado: DadoCobras | null;
  situacao: "jogando" | "fim";
  vencedor: number | null;
}

export function aplicarDado(pos: number, d6: DadoCobras): JogadaCobras {
  const caminho: number[] = [];
  let atual = pos;
  let direcao = 1;
  for (let passo = 0; passo < d6; passo++) {
    if (atual === 100) direcao = -1; // quique: o excesso volta
    atual += direcao;
    caminho.push(atual);
  }
  const pousou = atual;
  if (ESCADAS[pousou] !== undefined) {
    return { destino: ESCADAS[pousou], caminho, atalho: "escada" };
  }
  if (COBRAS[pousou] !== undefined) {
    return { destino: COBRAS[pousou], caminho, atalho: "cobra" };
  }
  return { destino: pousou, caminho, atalho: null };
}

export function criarPartida(jogadores: 2 | 3 | 4): EstadoCobras {
  return {
    jogadores,
    posicoes: Array.from({ length: jogadores }, () => 0),
    vez: 0,
    dado: null,
    situacao: "jogando",
    vencedor: null,
  };
}

export function jogar(estado: EstadoCobras, d6: DadoCobras): EstadoCobras {
  if (estado.situacao !== "jogando") return estado;
  const { destino } = aplicarDado(estado.posicoes[estado.vez], d6);
  const posicoes = [...estado.posicoes];
  posicoes[estado.vez] = destino;
  if (destino === 100) {
    return { ...estado, posicoes, dado: d6, situacao: "fim", vencedor: estado.vez };
  }
  return {
    ...estado,
    posicoes,
    dado: d6,
    vez: (estado.vez + 1) % estado.jogadores,
  };
}
