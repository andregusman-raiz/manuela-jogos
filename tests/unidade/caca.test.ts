import { describe, expect, test } from "vitest";
import { ENES, criarRng, ehCerto, gerarRodada, proximoNivelCaca } from "@/lib/caca/motor";
import type { NivelCaca } from "@/lib/caca/motor";

/** Constantes da SPEC HARD-CODED (importar do SUT deixaria mutações passarem). */
const CELULAS_SPEC = 16;
const ENES_SPEC = [12, 16, 18, 20, 24, 30];

/** ORÁCULO INDEPENDENTE: par/múltiplo/fator reimplementados aqui. */
function certoOraculo(tipo: string, alvo: number | undefined, n: number): boolean {
  if (tipo === "pares") return n % 2 === 0;
  if (tipo === "impares") return n % 2 !== 0;
  if (tipo === "multiplos") return n % alvo! === 0;
  return alvo! % n === 0 && n >= 1;
}

describe("gerarRodada — 200 por nível com oráculo próprio", () => {
  for (const nivel of [1, 2, 3] as NivelCaca[]) {
    test(`nível ${nivel}: 16 únicos, 4-8 certos, marcação bate com o oráculo`, () => {
      const rng = criarRng(700 + nivel);
      for (let i = 0; i < 200; i++) {
        const r = gerarRodada(nivel, rng);
        expect(r.grade).toHaveLength(CELULAS_SPEC);
        expect(new Set(r.grade).size).toBe(CELULAS_SPEC);
        expect(r.certos.length).toBeGreaterThanOrEqual(4);
        expect(r.certos.length).toBeLessThanOrEqual(8);

        const alvo = "alvo" in r.instrucao ? r.instrucao.alvo : undefined;
        for (let idx = 0; idx < CELULAS_SPEC; idx++) {
          const deveria = certoOraculo(r.instrucao.tipo, alvo, r.grade[idx]);
          expect(r.certos.includes(idx), `${r.instrucao.rotulo}: ${r.grade[idx]}`).toBe(deveria);
        }
      }
    });
  }

  test("nível 3: a grade contém TODOS os fatores de N", () => {
    const rng = criarRng(999);
    for (let i = 0; i < 200; i++) {
      const r = gerarRodada(3, rng);
      const alvo = (r.instrucao as { alvo: number }).alvo;
      const fatores = Array.from({ length: alvo }, (_, k) => k + 1).filter((n) => alvo % n === 0);
      for (const f of fatores) expect(r.grade, `fator ${f} de ${alvo} ausente`).toContain(f);
    }
  });

  test("os N são EXATAMENTE os da SPEC (36 com nove fatores fora — juízo)", () => {
    expect([...ENES].sort((a, b) => a - b)).toEqual(ENES_SPEC);
    for (const n of ENES_SPEC) {
      const fatores = Array.from({ length: n }, (_, k) => k + 1).filter((x) => n % x === 0);
      expect(fatores.length, `N=${n}`).toBeGreaterThanOrEqual(5);
      expect(fatores.length, `N=${n}`).toBeLessThanOrEqual(8);
    }
  });
});

describe("ehCerto — fixtures", () => {
  test("valores hard-coded", () => {
    expect(ehCerto({ tipo: "pares", rotulo: "" }, 8)).toBe(true);
    expect(ehCerto({ tipo: "impares", rotulo: "" }, 8)).toBe(false);
    expect(ehCerto({ tipo: "multiplos", alvo: 7, rotulo: "" }, 49)).toBe(true);
    expect(ehCerto({ tipo: "multiplos", alvo: 7, rotulo: "" }, 50)).toBe(false);
    expect(ehCerto({ tipo: "fatores", alvo: 24, rotulo: "" }, 8)).toBe(true);
    expect(ehCerto({ tipo: "fatores", alvo: 24, rotulo: "" }, 9)).toBe(false);
    // número MAIOR que o alvo nunca é fator — mata a mutação `||` (48 "fator" de 24)
    expect(ehCerto({ tipo: "fatores", alvo: 24, rotulo: "" }, 48)).toBe(false);
    expect(ehCerto({ tipo: "fatores", alvo: 12, rotulo: "" }, 24)).toBe(false);
  });
});

describe("progressão", () => {
  test("sobe até 3 e para", () => {
    expect(proximoNivelCaca(1)).toBe(2);
    expect(proximoNivelCaca(3)).toBe(3);
  });
});
