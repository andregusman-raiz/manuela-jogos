import { describe, expect, test } from "vitest";
import {
  ACERTOS_POR_FASE,
  aplicar,
  criarJogo,
  criarRng,
  duracaoQueda,
  gerarRodada,
  proximoNivel,
} from "@/lib/contas/motor";
import type { Nivel } from "@/lib/contas/tipos";

/** Avalia a conta exibida — oráculo independente do motor. */
function calcular(conta: string): number {
  const [a, op, b] = conta.split(" ");
  const x = Number(a);
  const y = Number(b);
  if (op === "+") return x + y;
  if (op === "−") return x - y;
  if (op === "×") return x * y;
  throw new Error(`operador desconhecido em "${conta}"`);
}

function operandos(conta: string): [number, string, number] {
  const [a, op, b] = conta.split(" ");
  return [Number(a), op, Number(b)];
}

describe("gerarRodada — SPEC §4.1: 200 rodadas por nível", () => {
  for (const nivel of [1, 2, 3, 4, 5] as Nivel[]) {
    test(`nível ${nivel}: resposta presente, 4 opções únicas >= 0, faixa correta`, () => {
      const rng = criarRng(1000 + nivel);
      for (let i = 0; i < 200; i++) {
        const r = gerarRodada(nivel, rng);

        expect(r.opcoes).toHaveLength(4);
        expect(new Set(r.opcoes).size).toBe(4);
        expect(r.opcoes).toContain(r.resposta);
        for (const o of r.opcoes) expect(o).toBeGreaterThanOrEqual(0);

        // a resposta confere com a conta exibida (oráculo próprio do teste)
        expect(calcular(r.conta)).toBe(r.resposta);

        const [a, op, b] = operandos(r.conta);
        if (nivel === 1) {
          expect(op).toBe("+");
          expect(a + b).toBeLessThanOrEqual(10);
        }
        if (nivel === 2) {
          expect(["+", "−"]).toContain(op);
          if (op === "+") expect(a + b).toBeLessThanOrEqual(20);
          // subtração nunca negativa
          if (op === "−") {
            expect(a).toBeGreaterThanOrEqual(b);
            expect(a).toBeLessThanOrEqual(20);
          }
        }
        if (nivel === 3) {
          expect(op).toBe("×");
          expect(a).toBeGreaterThanOrEqual(2);
          expect(a).toBeLessThanOrEqual(5);
          expect(b).toBeGreaterThanOrEqual(1);
          expect(b).toBeLessThanOrEqual(10);
        }
        if (nivel === 4) {
          expect(op).toBe("×");
          expect(a).toBeGreaterThanOrEqual(6);
          expect(a).toBeLessThanOrEqual(9);
          expect(b).toBeGreaterThanOrEqual(1);
          expect(b).toBeLessThanOrEqual(10);
        }
        if (nivel === 5) {
          // toda rodada do misto respeita a faixa de UM dos níveis 1-4
          const dentroDeAlgumaFaixa =
            (op === "+" && a + b <= 20) ||
            (op === "−" && a >= b && a <= 20) ||
            (op === "×" &&
              ((a >= 2 && a <= 5) || (a >= 6 && a <= 9)) &&
              b >= 1 &&
              b <= 10);
          expect(dentroDeAlgumaFaixa, `rodada fora das faixas: ${r.conta}`).toBe(true);
        }
      }
    });
  }

  test("nível 5 mistura os 4 tipos (todos aparecem em 200 rodadas)", () => {
    const rng = criarRng(42);
    const tipos = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const r = gerarRodada(5, rng);
      const [a, op] = operandos(r.conta);
      if (op === "+") tipos.add(calcular(r.conta) <= 10 && a <= 10 ? "soma" : "soma20");
      if (op === "−") tipos.add("subtracao");
      if (op === "×") tipos.add(a <= 5 ? "tabuada-baixa" : "tabuada-alta");
    }
    expect(tipos.has("subtracao")).toBe(true);
    expect(tipos.has("tabuada-baixa")).toBe(true);
    expect(tipos.has("tabuada-alta")).toBe(true);
    // alguma soma (até 10 ou até 20)
    expect(tipos.has("soma") || tipos.has("soma20")).toBe(true);
  });
});

describe("máquina de estados — SPEC §4.1: transição atômica", () => {
  test("toque-certo e chegou-base: o primeiro vence, o segundo é ignorado", () => {
    const rng = criarRng(7);
    const inicial = criarJogo(1, rng);

    const acertou = aplicar(inicial, "toque-certo", rng);
    expect(acertou.fase).toBe("resolvida");
    expect(acertou.acertos).toBe(1);
    // evento atrasado do timer: MESMO estado (referência), não conta erro
    expect(aplicar(acertou, "chegou-base", rng)).toBe(acertou);

    const quicou = aplicar(inicial, "chegou-base", rng);
    expect(quicou.fase).toBe("quicou");
    expect(quicou.reapresentada).toBe(true);
    // toque atrasado depois do quique: ignorado
    expect(aplicar(quicou, "toque-certo", rng)).toBe(quicou);
  });

  test("quicou + proxima reapresenta a MESMA conta; resolvida + proxima gera outra", () => {
    const rng = criarRng(11);
    const inicial = criarJogo(2, rng);

    const quicou = aplicar(inicial, "chegou-base", rng);
    const devolta = aplicar(quicou, "proxima", rng);
    expect(devolta.fase).toBe("caindo");
    expect(devolta.rodada).toBe(inicial.rodada);
    expect(devolta.reapresentada).toBe(true);

    const resolvida = aplicar(inicial, "toque-certo", rng);
    const nova = aplicar(resolvida, "proxima", rng);
    expect(nova.fase).toBe("caindo");
    expect(nova.rodada).not.toBe(inicial.rodada);
    expect(nova.reapresentada).toBe(false);
  });

  test(`${ACERTOS_POR_FASE}º acerto vira fase-completa e rejeita qualquer evento`, () => {
    const rng = criarRng(13);
    let estado = criarJogo(3, rng);
    for (let i = 0; i < ACERTOS_POR_FASE; i++) {
      estado = aplicar(estado, "toque-certo", rng);
      if (estado.fase === "resolvida") estado = aplicar(estado, "proxima", rng);
    }
    expect(estado.fase).toBe("fase-completa");
    expect(estado.acertos).toBe(ACERTOS_POR_FASE);
    // nada spawna depois da fase completa
    expect(aplicar(estado, "proxima", rng)).toBe(estado);
    expect(aplicar(estado, "toque-certo", rng)).toBe(estado);
    expect(aplicar(estado, "chegou-base", rng)).toBe(estado);
  });
});

describe("ritmo e progressão — valores da SPEC", () => {
  test("duração da queda: 12s no nível 1, piso 8s, +35% na reapresentação", () => {
    expect(duracaoQueda(1, false)).toBe(12);
    expect(duracaoQueda(2, false)).toBe(11);
    expect(duracaoQueda(5, false)).toBe(8);
    expect(duracaoQueda(1, true)).toBeCloseTo(16.2);
  });

  test("próximo nível sobe até 5 e para", () => {
    expect(proximoNivel(1)).toBe(2);
    expect(proximoNivel(4)).toBe(5);
    expect(proximoNivel(5)).toBe(5);
  });
});
