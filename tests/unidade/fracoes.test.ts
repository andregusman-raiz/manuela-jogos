import { describe, expect, test } from "vitest";
import {
  alternarFatia,
  anguloDaFatia,
  comparar,
  conferir,
  criarRng,
  gerarRodada,
  opcoesDe,
  rotular,
} from "@/lib/fracoes/motor";
import type { NivelFracoes, RodadaConstruir } from "@/lib/fracoes/motor";

/** Oráculo do teste: compara por aritmética própria (cross-product refeito). */
function valorIgual(a: string, b: string): boolean {
  const [an, ad] = a.split("/").map(Number);
  const [bn, bd] = b.split("/").map(Number);
  return an * bd === bn * ad;
}

describe("comparar — produto cruzado (fixtures da SPEC)", () => {
  test("1/2 vs 2/4 = igual; 2/3 vs 3/5 = a; 3/8 vs 1/2 = b", () => {
    expect(comparar({ n: 1, d: 2 }, { n: 2, d: 4 })).toBe("igual");
    expect(comparar({ n: 2, d: 3 }, { n: 3, d: 5 })).toBe("a");
    expect(comparar({ n: 3, d: 8 }, { n: 1, d: 2 })).toBe("b");
  });
});

describe("ângulos das fatias", () => {
  test("fatia 0 de 4 = 0°..90°; fatia 3 de 8 = 135°..180°", () => {
    expect(anguloDaFatia(0, 4)).toEqual({ inicio: 0, fim: 90 });
    expect(anguloDaFatia(3, 8)).toEqual({ inicio: 135, fim: 180 });
  });
});

describe("opções — 200 rodadas, unicidade POR VALOR", () => {
  test("sempre 4 opções, sem valores repetidos, com a certa — inclusive 1/2", () => {
    const rng = criarRng(31);
    for (let i = 0; i < 200; i++) {
      const rodada = gerarRodada(1, rng);
      if (rodada.tipo !== "ler") throw new Error("nível 1 deveria ser ler");
      expect(rodada.opcoes).toHaveLength(4);
      expect(rodada.opcoes).toContain(rotular(rodada.alvo));
      for (let x = 0; x < 4; x++) {
        for (let y = x + 1; y < 4; y++) {
          expect(
            valorIgual(rodada.opcoes[x], rodada.opcoes[y]),
            `valores iguais: ${rodada.opcoes[x]} e ${rodada.opcoes[y]}`,
          ).toBe(false);
        }
      }
      // toda opção é N'/D' com 1<=N'<=D'<=8 (imprópria só até o inteiro)
      for (const opcao of rodada.opcoes) {
        const [n, d] = opcao.split("/").map(Number);
        expect(n).toBeGreaterThanOrEqual(1);
        expect(n).toBeLessThanOrEqual(d);
        expect(d).toBeGreaterThanOrEqual(2);
        expect(d).toBeLessThanOrEqual(8);
      }
    }
  });

  test("o caso extremo 1/2 tem 4 opções válidas (blocker do juízo)", () => {
    const opcoes = opcoesDe({ n: 1, d: 2 }, criarRng(1));
    expect(opcoes).toHaveLength(4);
    expect(opcoes).toContain("1/2");
  });
});

describe("nível 2 — máquina de conferir", () => {
  function rodadaCom(pintadas: number): RodadaConstruir {
    let r: RodadaConstruir = {
      tipo: "construir",
      alvo: { n: 3, d: 4 },
      fase: "montando",
      pintadas: [false, false, false, false],
    };
    for (let k = 0; k < pintadas; k++) r = alternarFatia(r, k);
    return r;
  }

  test("conferir certo resolve; conferir de novo é a MESMA referência", () => {
    const certo = conferir(rodadaCom(3));
    expect(certo.certo).toBe(true);
    expect(certo.rodada.fase).toBe("resolvida");
    const denovo = conferir(certo.rodada);
    expect(denovo.rodada).toBe(certo.rodada); // acerto duplo impossível
  });

  test("conferir errado mantém a pintura e a fase", () => {
    const errado = conferir(rodadaCom(2));
    expect(errado.certo).toBe(false);
    expect(errado.rodada.fase).toBe("montando");
    expect(errado.rodada.pintadas.filter(Boolean)).toHaveLength(2);
  });

  test("alternar fatia fora da faixa ou após resolver é no-op", () => {
    const r = rodadaCom(3);
    expect(alternarFatia(r, 9)).toBe(r);
    const { rodada } = conferir(r);
    expect(alternarFatia(rodada, 0)).toBe(rodada);
  });
});

describe("gerarRodada por nível", () => {
  for (const nivel of [1, 2, 3] as NivelFracoes[]) {
    test(`nível ${nivel}: frações próprias com D 2..8`, () => {
      const rng = criarRng(500 + nivel);
      for (let i = 0; i < 100; i++) {
        const r = gerarRodada(nivel, rng);
        const fracoes =
          r.tipo === "comparar" ? [r.a, r.b] : [r.alvo];
        for (const f of fracoes) {
          expect(f.n).toBeGreaterThanOrEqual(1);
          expect(f.n).toBeLessThan(f.d);
          expect(f.d).toBeGreaterThanOrEqual(2);
          expect(f.d).toBeLessThanOrEqual(8);
        }
      }
    });
  }
});
