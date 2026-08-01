import { describe, expect, test } from "vitest";
import { criarSorte } from "@/lib/dado";
import {
  COLUNAS,
  LINHAS,
  colunasLegais,
  criarPartida,
  empate,
  iaJogar,
  jogar,
  vencedorNaGrade,
} from "@/lib/lig4/motor";
import type { EstadoLig4 } from "@/lib/lig4/motor";

/** Monta um estado jogando uma sequência de colunas a partir do zero. */
function partidaCom(colunas: number[]): EstadoLig4 {
  let e = criarPartida();
  for (const c of colunas) e = jogar(e, c);
  return e;
}

const AZAR_TOTAL = () => 0.999; // sorte que SEMPRE cai no ramo da distração

describe("vitórias nas 4 direções (posições hard-coded)", () => {
  test("horizontal na linha do fundo", () => {
    // J0 joga 0,1,2,3; J1 responde em cima
    const e = partidaCom([0, 0, 1, 1, 2, 2, 3]);
    expect(e.situacao).toBe("fim");
    expect(e.vencedor).toBe(0);
  });

  test("vertical", () => {
    const e = partidaCom([2, 3, 2, 3, 2, 3, 2]);
    expect(e.vencedor).toBe(0);
  });

  test("diagonal ↗", () => {
    // escadinha clássica: J0 em (0,0),(1,1),(2,2),(3,3)
    const e = partidaCom([0, 1, 1, 2, 2, 3, 2, 3, 3, 6, 3]);
    expect(e.vencedor).toBe(0);
  });

  test("diagonal ↘", () => {
    const e = partidaCom([3, 2, 2, 1, 1, 0, 1, 0, 0, 6, 0]);
    expect(e.vencedor).toBe(0);
  });

  test("coluna cheia é no-op e empate fecha sem vencedor", () => {
    let e = criarPartida();
    for (let i = 0; i < LINHAS; i++) e = jogar(e, 0);
    expect(e.grade[0][LINHAS - 1]).not.toBeNull();
    const antes = e;
    expect(jogar(e, 0)).toBe(antes);

    // padrão de empate conhecido: colunas em pares deslocados
    const ordem: number[] = [];
    for (const bloco of [
      [0, 1, 2],
      [3, 4, 5],
    ]) {
      for (let l = 0; l < LINHAS; l++) for (const c of bloco) ordem.push(c);
    }
    for (let l = 0; l < LINHAS; l++) ordem.push(6);
    let jogo = criarPartida();
    for (const c of ordem) jogo = jogar(jogo, c);
    expect(jogo.situacao).toBe("fim");
    expect(jogo.vencedor).toBeNull(); // ordem construída SEM 4 em linha
    expect(empate(jogo)).toBe(true);
    expect(jogo.grade.flat().filter((v) => v !== null)).toHaveLength(42);
  });
});

describe("IA — regras duras NUNCA puladas pela distração", () => {
  test("vence em 1 mesmo com distração total e sorte ruim", () => {
    // J1 (IA) tem 3 na vertical da coluna 5; vez do J1
    const e = partidaCom([0, 5, 1, 5, 0, 5, 1]);
    expect(e.vez).toBe(1);
    expect(iaJogar(e, AZAR_TOTAL, 1)).toBe(5);
  });

  test("bloqueia ameaça única mesmo com distração total", () => {
    // humano (J0) tem 3 no fundo (colunas 0-2); vez da IA (J1)
    const e = partidaCom([0, 6, 1, 6, 2]);
    expect(e.vez).toBe(1);
    expect(iaJogar(e, AZAR_TOTAL, 1)).toBe(3);
  });

  test("ameaça dupla (posição do juiz): bloqueia uma das duas", () => {
    // H col2, IA col0, H col3, IA col6, H col4 (0-based) → ameaças em 1 e 5
    const e = partidaCom([2, 0, 3, 6, 4]);
    expect(e.vez).toBe(1);
    const resposta = iaJogar(e, AZAR_TOTAL, 1);
    expect([1, 5]).toContain(resposta);
  });

  test("vitória própria vale MAIS que bloquear", () => {
    // ambos têm 3: IA vence em 1 na col 5 em vez de bloquear a col 3
    const e = partidaCom([0, 5, 1, 5, 2, 5, 6]);
    expect(e.vez).toBe(1);
    expect(iaJogar(e, AZAR_TOTAL, 1)).toBe(5);
  });

  test("fuzz: 300 estados aleatórios — resposta sempre legal, nunca coluna cheia", () => {
    const sorte = criarSorte(99);
    for (let partida = 0; partida < 300; partida++) {
      let e = criarPartida();
      const passos = Math.floor(sorte() * 30);
      for (let i = 0; i < passos && e.situacao === "jogando"; i++) {
        const legais = colunasLegais(e);
        e = jogar(e, legais[Math.floor(sorte() * legais.length)]);
      }
      if (e.situacao !== "jogando") continue;
      const escolha = iaJogar(e, sorte, 0.5);
      expect(colunasLegais(e)).toContain(escolha);
    }
  });
});

describe("sanidade da grade", () => {
  test("dimensões e alternância", () => {
    const e = criarPartida();
    expect(e.grade).toHaveLength(COLUNAS);
    expect(e.grade[0]).toHaveLength(LINHAS);
    const depois = jogar(e, 3);
    expect(depois.vez).toBe(1);
    expect(depois.grade[3][0]).toBe(0);
    expect(vencedorNaGrade(depois.grade)).toBeNull();
  });

  test("peça cai na menor linha livre", () => {
    const e = partidaCom([4, 4, 4]);
    expect(e.grade[4][0]).toBe(0);
    expect(e.grade[4][1]).toBe(1);
    expect(e.grade[4][2]).toBe(0);
  });
});

describe("determinismo da IA sob semente", () => {
  test("mesma semente, mesma partida inteira", () => {
    const jogarPartida = (): number[] => {
      const sorte = criarSorte(41);
      let e = criarPartida();
      const escolhas: number[] = [];
      while (e.situacao === "jogando") {
        const c = iaJogar(e, sorte, 0.3);
        escolhas.push(c);
        e = jogar(e, c);
      }
      return escolhas;
    };
    expect(jogarPartida()).toEqual(jogarPartida());
  });
});
