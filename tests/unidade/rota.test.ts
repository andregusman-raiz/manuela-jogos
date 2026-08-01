import { describe, expect, test } from "vitest";
import {
  acoesLegais,
  adjacentes,
  aplicar,
  colocar,
  criarPartida,
  faseDe,
  iaJogarRota,
  moverPeca,
  vencedorNaPosicao,
} from "@/lib/rota/motor";
import type { EstadoRota, JogadorRota } from "@/lib/rota/motor";

/** As 12 linhas RE-DECLARADAS literalmente (oráculo independente do motor). */
const LINHAS_ORACULO: number[][] = [
  [0, 1, 2],
  [1, 2, 3],
  [2, 3, 4],
  [3, 4, 5],
  [4, 5, 6],
  [5, 6, 7],
  [6, 7, 0],
  [7, 0, 1],
  [0, 8, 4],
  [1, 8, 5],
  [2, 8, 6],
  [3, 8, 7],
];

function vencedorOraculo(casas: (JogadorRota | null)[]): JogadorRota | null {
  for (const dono of [0, 1] as const) {
    if (LINHAS_ORACULO.some((l) => l.every((c) => casas[c] === dono))) return dono;
  }
  return null;
}

function jogarSequencia(acoes: Array<[number] | [number, number]>): EstadoRota {
  let e = criarPartida();
  for (const acao of acoes) {
    e = acao.length === 1 ? colocar(e, acao[0]) : moverPeca(e, acao[0], acao[1]);
  }
  return e;
}

describe("verificação EXAUSTIVA do espaço alcançável (SPEC §5.2)", () => {
  test("5.230 estados, 3.990 ocupações, nunca sem movimento, vencedor bate com oráculo", () => {
    const chave = (casas: (JogadorRota | null)[], vez: number) =>
      casas.map((c) => (c === null ? "." : c)).join("") + vez;
    const inicial = criarPartida();
    const visitados = new Set<string>([chave(inicial.casas, 0)]);
    const ocupacoes = new Set<string>();
    const fila: EstadoRota[] = [inicial];
    let terminais = 0;

    while (fila.length) {
      const e = fila.pop()!;
      ocupacoes.add(e.casas.map((c) => (c === null ? "." : c)).join(""));

      // (b) o vencedor do motor bate com as 12 linhas re-declaradas
      const doMotor = vencedorNaPosicao(e.casas);
      expect(doMotor).toBe(vencedorOraculo(e.casas));
      // (c) nunca vitória dupla — CONTADA explicitamente (review PR #40:
      // comparar retornos deixaria passar um estado com DOIS vencedores)
      const donosComLinha = ([0, 1] as const).filter((dono) =>
        LINHAS_ORACULO.some((l) => l.every((c) => e.casas[c] === dono)),
      );
      expect(donosComLinha.length, "vitória dupla alcançável").toBeLessThanOrEqual(1);

      if (doMotor !== null) {
        terminais++;
        continue;
      }
      const acoes = acoesLegais(e);
      // (a) quem tem a vez SEMPRE tem jogada (regra de skip é código morto)
      expect(acoes.length, `estado ${chave(e.casas, e.vez)} sem jogada`).toBeGreaterThan(0);
      for (const a of acoes) {
        const d = aplicar({ ...e, historico: {} }, a);
        const k = chave(d.casas, d.situacao === "fim" ? e.vez : d.vez);
        if (!visitados.has(k)) {
          visitados.add(k);
          fila.push(d);
        }
      }
    }

    // contagens-oráculo: iguais à enumeração INDEPENDENTE do juiz da SPEC
    expect(visitados.size).toBe(5230);
    expect(ocupacoes.size).toBe(3990);
    expect(terminais).toBe(580);
  });
});

describe("regras básicas", () => {
  test("adjacência: anel ±1 e centro conectado a tudo", () => {
    expect(adjacentes(0).sort()).toEqual([1, 7, 8]);
    expect(adjacentes(7).sort()).toEqual([0, 6, 8]);
    expect(adjacentes(8)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  test("colocação alterna e vira movimento com 6 peças", () => {
    const e = jogarSequencia([[0], [1], [2], [3], [6], [5]]);
    expect(faseDe(e)).toBe("movimento");
    expect(colocar(e, 7)).toBe(e); // colocar após a fase é no-op
    expect(moverPeca(e, 0, 8).casas[8]).toBe(0);
  });

  test("vitória por ARCO já na colocação", () => {
    // A coloca 0,1,2 (B em 4,6): arco [0,1,2] fecha na 5ª colocação
    const e = jogarSequencia([[0], [4], [1], [6], [2]]);
    expect(e.situacao).toBe("fim");
    expect(e.vencedor).toBe(0);
  });

  test("vitória por DIÂMETRO na fase de movimento", () => {
    // A: 0, 4, 6; B: 1, 3, 5 → A move 6→8 e fecha 0-8-4
    const e = jogarSequencia([[0], [1], [4], [3], [6], [5], [6, 8]]);
    expect(e.situacao).toBe("fim");
    expect(e.vencedor).toBe(0);
  });

  test("movimento ilegal é no-op (não adjacente, casa cheia, peça alheia)", () => {
    const e = jogarSequencia([[0], [1], [2], [3], [6], [5]]);
    expect(moverPeca(e, 0, 4)).toBe(e); // não adjacente
    expect(moverPeca(e, 0, 1)).toBe(e); // ocupada
    expect(moverPeca(e, 1, 8)).toBe(e); // peça do outro
  });
});

describe("empate por repetição (blocker J10)", () => {
  test("o ciclo do juiz termina em empate na 3ª visita à mesma configuração", () => {
    // A={0,2,4}, B={1,3,5}; ciclo A:4→8, B:5→6, A:8→4, B:6→5 (2 voltas)
    let e = jogarSequencia([[0], [1], [2], [3], [4], [5]]);
    expect(e.situacao).toBe("jogando");
    const ciclo: Array<[number, number]> = [
      [4, 8],
      [5, 6],
      [8, 4],
      [6, 5],
    ];
    // 1ª volta completa: a configuração repetiu pela 2ª vez — AINDA jogando
    // (mata o mutante "empata na 2ª visita" — review PR #40)
    for (const [de, para] of ciclo) {
      e = moverPeca(e, de, para);
      expect(e.situacao).toBe("jogando");
    }
    // 2ª volta: os 3 primeiros movimentos seguem jogando; o 8º fecha o empate
    for (const [i, [de, para]] of ciclo.entries()) {
      e = moverPeca(e, de, para);
      expect(e.situacao).toBe(i === ciclo.length - 1 ? "empate" : "jogando");
    }
    expect(e.vencedor).toBeNull();
  });
});

describe("Manu (IA)", () => {
  const SORTE_FIXA = () => 0.01;

  test("vence em 1 quando pode (colocação, vitória ÚNICA)", () => {
    // vez da IA (jogador 1) com 5,7 postas: a ÚNICA vitória é fechar o
    // arco [5,6,7] na casa 6 (com 5,6 postas haveria DUAS — arco 4-5-6 também)
    const e = jogarSequencia([[0], [5], [2], [7], [8]]);
    expect(e.vez).toBe(1);
    const acao = iaJogarRota(e, SORTE_FIXA);
    expect(acao).toEqual({ tipo: "colocar", casa: 6 });
  });

  test("bloqueia vitória iminente do humano", () => {
    // humano (0) tem 0,1 → ameaça arco em 2 e em 7; IA coloca numa delas
    const e = jogarSequencia([[0], [4], [1]]);
    expect(e.vez).toBe(1);
    const acao = iaJogarRota(e, SORTE_FIXA);
    expect(acao.tipo).toBe("colocar");
    expect([2, 7]).toContain(acao.casa);
  });

  test("resposta sempre legal (fuzz nas duas fases)", () => {
    let x = 17;
    const sorte = () => {
      x = (x * 16807) % 2147483647;
      return (x - 1) / 2147483646;
    };
    for (let partida = 0; partida < 200; partida++) {
      let e = criarPartida();
      let lances = 0;
      while (e.situacao === "jogando" && lances < 60) {
        const acao = iaJogarRota(e, sorte);
        const depois = aplicar(e, acao);
        expect(depois, `lance ilegal na partida ${partida}`).not.toBe(e);
        e = depois;
        lances++;
      }
    }
  });
});
