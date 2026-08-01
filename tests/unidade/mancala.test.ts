import { describe, expect, test } from "vitest";
import { criarSorte } from "@/lib/dado";
import {
  covasLegais,
  criarPartida,
  iaEscolher,
  semear,
} from "@/lib/mancala/motor";
import type { EstadoMancala, LadoMancala } from "@/lib/mancala/motor";

function estadoCom(
  covas: [number[], number[]],
  kalahs: [number, number],
  vez: LadoMancala = 0,
): EstadoMancala {
  return { covas, kalahs, vez, situacao: "jogando", vencedor: null };
}

function soma(estado: EstadoMancala): number {
  return (
    estado.covas[0].reduce((a, b) => a + b, 0) +
    estado.covas[1].reduce((a, b) => a + b, 0) +
    estado.kalahs[0] +
    estado.kalahs[1]
  );
}

describe("semeadura", () => {
  test("pula o kalah adversário (volta completa)", () => {
    // 8 sementes da cova 5: KA, B0..B5 (pula KB), A0 — A0 já tem 1 semente
    // para a última NÃO configurar captura (cova não-vazia)
    const estado = estadoCom([[1, 0, 0, 0, 0, 8], [1, 1, 1, 1, 1, 1]], [0, 0]);
    const depois = semear(estado, 5);
    expect(depois.kalahs[0]).toBe(1);
    expect(depois.kalahs[1]).toBe(0); // pulado
    expect(depois.covas[1]).toEqual([2, 2, 2, 2, 2, 2]);
    expect(depois.covas[0][0]).toBe(2); // recebeu sem capturar
    expect(depois.vez).toBe(1);
  });

  test("volta completa TERMINANDO em cova vazia própria captura (encadeado)", () => {
    // o cenário que confundiu o autor: A0 vazia + oposta B5 cheia = captura
    const estado = estadoCom([[0, 0, 0, 0, 0, 8], [1, 1, 1, 1, 1, 1]], [0, 0]);
    const depois = semear(estado, 5);
    expect(depois.kalahs[0]).toBe(4); // 1 do kalah + captura (1 + B5=2)
    expect(depois.situacao).toBe("fim"); // lado A esvaziou → varredura
    expect(depois.kalahs[1]).toBe(10);
    expect(depois.vencedor).toBe(1);
  });

  test("pulo DUPLO do kalah adversário — estado do juiz (J7), layout final hard-coded", () => {
    const estado = estadoCom([[0, 0, 0, 0, 27, 3], [0, 0, 2, 2, 0, 0]], [9, 5]);
    const depois = semear(estado, 4);
    expect(depois.covas[0]).toEqual([2, 2, 2, 2, 2, 6]); // última semente na A6 (1-based)
    expect(depois.covas[1]).toEqual([2, 2, 4, 4, 2, 2]);
    expect(depois.kalahs[0]).toBe(11); // passou 2× pelo próprio kalah
    expect(depois.kalahs[1]).toBe(5); // PULADO nas duas voltas
    expect(depois.vez).toBe(1); // sem extra
    expect(soma(depois)).toBe(48);
  });

  test("última no próprio kalah → joga de novo", () => {
    const estado = estadoCom([[0, 0, 4, 0, 0, 0], [4, 4, 4, 4, 4, 4]], [0, 0]);
    const depois = semear(estado, 2); // A3,A4,A5,KA
    expect(depois.kalahs[0]).toBe(1);
    expect(depois.vez).toBe(0);
    expect(depois.situacao).toBe("jogando");
  });

  test("captura: última em cova própria VAZIA com oposta cheia", () => {
    // semear A0 (1 semente) → cai em A1 (vazia); oposta de A1 é B4 (3)
    const estado = estadoCom([[1, 0, 2, 2, 2, 2], [2, 2, 2, 2, 3, 2]], [0, 0]);
    const depois = semear(estado, 0);
    expect(depois.covas[0][1]).toBe(0);
    expect(depois.covas[1][4]).toBe(0);
    expect(depois.kalahs[0]).toBe(4); // 1 + 3
    expect(soma(depois)).toBe(soma(estado));
  });

  test("NÃO captura quando a oposta está vazia", () => {
    const estado = estadoCom([[1, 0, 2, 2, 2, 2], [2, 2, 2, 2, 0, 2]], [0, 0]);
    const depois = semear(estado, 0);
    expect(depois.covas[0][1]).toBe(1); // fica lá
    expect(depois.kalahs[0]).toBe(0);
  });

  test("cova vazia é no-op", () => {
    const estado = estadoCom([[0, 4, 4, 4, 4, 4], [4, 4, 4, 4, 4, 4]], [0, 0]);
    expect(semear(estado, 0)).toBe(estado);
  });

  test("13 sementes: volta completa termina na PRÓPRIA origem vazia e captura (review PR #39)", () => {
    const estado = estadoCom([[1, 1, 13, 1, 1, 1], [1, 1, 1, 2, 1, 1]], [0, 0]);
    const depois = semear(estado, 2);
    expect(depois.covas[0]).toEqual([2, 2, 0, 2, 2, 2]); // origem capturada
    expect(depois.covas[1]).toEqual([2, 2, 2, 0, 2, 2]); // oposta (B3) levada junto
    expect(depois.kalahs[0]).toBe(5); // 1 do walk + captura (1 + 3)
    expect(soma(depois)).toBe(soma(estado));
  });
});

describe("fim de jogo", () => {
  test("FIM DOMINA a jogada extra — estado do juiz (J8)", () => {
    const estado = estadoCom([[0, 0, 0, 0, 0, 1], [1, 1, 1, 1, 1, 1]], [20, 21]);
    const depois = semear(estado, 5); // última no KA (extra), mas o lado A esvaziou
    expect(depois.situacao).toBe("fim"); // NADA de vez extra
    expect(depois.kalahs[0]).toBe(21);
    expect(depois.kalahs[1]).toBe(27); // varreu as 6 de B
    expect(depois.vencedor).toBe(1);
    expect(soma(depois)).toBe(48);
  });

  test("captura que esvazia o ADVERSÁRIO dispara o fim com varredura (review PR #39)", () => {
    // a captura zera a última cova de B → fim; A varre as próprias restantes
    const estado = estadoCom([[1, 0, 1, 1, 1, 1], [0, 0, 0, 0, 1, 0]], [21, 21]);
    const depois = semear(estado, 0);
    expect(depois.situacao).toBe("fim");
    expect(depois.kalahs).toEqual([27, 21]); // 21 + captura 2 + varredura 4
    expect(depois.vencedor).toBe(0);
    expect(soma(depois)).toBe(48);
  });

  test("empate 24×24 declarado", () => {
    const estado = estadoCom([[0, 0, 0, 0, 0, 1], [3, 0, 0, 0, 0, 0]], [23, 21]);
    const depois = semear(estado, 5);
    expect(depois.situacao).toBe("fim");
    expect(depois.kalahs[0]).toBe(24);
    expect(depois.kalahs[1]).toBe(24);
    expect(depois.vencedor).toBeNull();
  });

  test("fuzz seeded: 500 partidas terminam em ≤200 jogadas com 48 sementes SEMPRE", () => {
    const sorte = criarSorte(5);
    for (let partida = 0; partida < 500; partida++) {
      let e = criarPartida();
      let jogadas = 0;
      while (e.situacao === "jogando" && jogadas < 200) {
        const legais = covasLegais(e);
        e = semear(e, legais[Math.floor(sorte() * legais.length)]);
        expect(soma(e)).toBe(48);
        jogadas++;
      }
      expect(e.situacao, `partida ${partida} passou de 200 jogadas`).toBe("fim");
    }
  });
});

describe("Manu greedy", () => {
  test("escolhe a captura óbvia", () => {
    // vez do lado 1: semear B0 (1) cai em B1 vazia, oposta A4 tem 6 → ganho 7
    const estado = estadoCom([[2, 2, 2, 2, 6, 2], [1, 0, 2, 2, 2, 2]], [0, 0], 1);
    expect(iaEscolher(estado)).toBe(0);
  });

  test("empate de ganho: prefere a jogada extra à cova mais à direita", () => {
    // B1 com 6 sementes: passa pelo KB (ganho 1) e segue até A0 — SEM extra;
    // B2 com 4: termina exatamente no KB (ganho 1) COM extra → escolhe B2
    const estado = estadoCom([[4, 4, 4, 4, 4, 4], [0, 6, 4, 0, 0, 0]], [0, 0], 1);
    expect(iaEscolher(estado)).toBe(2);
  });

  test("empate EXATO de ganho e extra: fica a cova mais à direita (review PR #39)", () => {
    // B0 (2 sementes) e B1 (1) capturam A[3]=4 cada: ganho 5, sem extra → 1
    const estado = estadoCom([[4, 4, 4, 4, 4, 4], [2, 1, 0, 0, 0, 0]], [0, 0], 1);
    expect(iaEscolher(estado)).toBe(1);
  });

  test("resposta sempre legal (fuzz)", () => {
    const sorte = criarSorte(31);
    for (let partida = 0; partida < 200; partida++) {
      let e = criarPartida();
      let jogadas = 0;
      while (e.situacao === "jogando" && jogadas < 200) {
        const escolha =
          e.vez === 1
            ? iaEscolher(e)
            : covasLegais(e)[Math.floor(sorte() * covasLegais(e).length)];
        expect(covasLegais(e)).toContain(escolha);
        e = semear(e, escolha);
        jogadas++;
      }
    }
  });
});
