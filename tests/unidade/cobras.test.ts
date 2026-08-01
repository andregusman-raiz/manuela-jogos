import { describe, expect, test } from "vitest";
import { criarDado } from "@/lib/dado";
import { COBRAS, ESCADAS, aplicarDado, criarPartida, jogar } from "@/lib/cobras/motor";
import type { DadoCobras } from "@/lib/cobras/motor";
import { celulaDaCasa } from "@/lib/cobras/tabuleiro";

describe("atalhos — tabela-oráculo RE-DECLARADA (SPEC §2.3)", () => {
  // literal, não importada: mutação no mapa da engine morre aqui
  const ORACULO: Array<[origem: number, destino: number, tipo: "escada" | "cobra"]> = [
    [4, 25, "escada"],
    [13, 46, "escada"],
    [33, 49, "escada"],
    [42, 63, "escada"],
    [50, 69, "escada"],
    [62, 81, "escada"],
    [74, 92, "escada"],
    [27, 5, "cobra"],
    [40, 3, "cobra"],
    [43, 18, "cobra"],
    [54, 31, "cobra"],
    [66, 45, "cobra"],
    [76, 58, "cobra"],
    [89, 53, "cobra"],
    [99, 41, "cobra"],
  ];

  test.each(ORACULO)("cair na %i leva à %i (%s)", (origem, destino, tipo) => {
    const jogada = aplicarDado(origem - 1, 1);
    expect(jogada.destino).toBe(destino);
    expect(jogada.atalho).toBe(tipo);
  });

  test("a tabela tem exatamente 15 entradas e nenhum encadeamento", () => {
    const origens = [...Object.keys(ESCADAS), ...Object.keys(COBRAS)].map(Number);
    const destinos = [...Object.values(ESCADAS), ...Object.values(COBRAS)];
    expect(origens).toHaveLength(15);
    for (const d of destinos) {
      expect(origens, `destino ${d} é origem de outro atalho`).not.toContain(d);
      expect(d).toBeGreaterThanOrEqual(2);
      expect(d).toBeLessThanOrEqual(99);
    }
  });
});

describe("quique no 100 (SPEC §2.1)", () => {
  test("98 + 5 quica para 97", () => {
    const jogada = aplicarDado(98, 5);
    expect(jogada.destino).toBe(97);
    expect(jogada.caminho).toEqual([99, 100, 99, 98, 97]);
    expect(jogada.atalho).toBeNull();
  });

  test("99 + 1 = 100 (vitória exata)", () => {
    expect(aplicarDado(99, 1).destino).toBe(100);
  });

  test("95 + 6 quica para 99 e a COBRA pega depois do quique → 41", () => {
    const jogada = aplicarDado(95, 6);
    expect(jogada.destino).toBe(41);
    expect(jogada.atalho).toBe("cobra");
    expect(jogada.caminho).toEqual([96, 97, 98, 99, 100, 99]);
  });

  test("fuzz: 1000 jogadas seeded nunca saem de [0,100]", () => {
    const dado = criarDado(7);
    let pos = 0;
    for (let i = 0; i < 1000; i++) {
      const { destino, caminho } = aplicarDado(pos, dado());
      for (const casa of caminho) {
        expect(casa).toBeGreaterThanOrEqual(0);
        expect(casa).toBeLessThanOrEqual(100);
      }
      expect(destino).toBeGreaterThanOrEqual(0);
      expect(destino).toBeLessThanOrEqual(100);
      pos = destino === 100 ? 0 : destino;
    }
  });
});

describe("partida", () => {
  test("vez circula e a vitória fecha o jogo", () => {
    let estado = criarPartida(2);
    estado = jogar(estado, 3);
    expect(estado.posicoes[0]).toBe(3);
    expect(estado.vez).toBe(1);
    estado = jogar(estado, 4); // jogador 1 cai na 4 → escada → 25
    expect(estado.posicoes[1]).toBe(25);
    expect(estado.vez).toBe(0);

    const quaseLa = { ...criarPartida(2), posicoes: [99, 50] };
    const fim = jogar(quaseLa, 1 as DadoCobras);
    expect(fim.situacao).toBe("fim");
    expect(fim.vencedor).toBe(0);
    expect(jogar(fim, 5 as DadoCobras)).toBe(fim); // no-op após o fim
  });
});

describe("geometria boustrophedon (oráculo literal)", () => {
  const ORACULO: Array<[casa: number, col: number, lin: number]> = [
    [1, 0, 9], // embaixo-esquerda
    [10, 9, 9], // fim da linha 1, direita
    [11, 9, 8], // linha 2 COMEÇA na direita
    [20, 0, 8], // e termina na esquerda
    [21, 0, 7], // linha 3 volta a começar na esquerda
    [100, 0, 0], // topo-esquerda
  ];
  test.each(ORACULO)("casa %i → coluna %i, linha %i", (casa, col, lin) => {
    expect(celulaDaCasa(casa)).toEqual([col, lin]);
  });
});
