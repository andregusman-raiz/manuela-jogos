import { describe, expect, test } from "vitest";
import {
  COMPRAS_POR_FASE,
  criarRng,
  devolverPeca,
  formatar,
  gerarRodada,
  pecasDoNivel,
  proximoNivelLojinha,
  somaDe,
  tocarPeca,
} from "@/lib/lojinha/motor";
import type { NivelLojinha } from "@/lib/lojinha/motor";

/**
 * ORÁCULO INDEPENDENTE (exigência da SPEC pós-juiz): DP de "moedas com
 * repetição" escrita AQUI no teste — nada de confiar no gerador para provar
 * a própria pagabilidade.
 */
function pagavelPorDP(preco: number, pecas: number[]): boolean {
  const alcancavel = new Array<boolean>(preco + 1).fill(false);
  alcancavel[0] = true;
  for (let v = 1; v <= preco; v++) {
    for (const p of pecas) {
      if (p <= v && alcancavel[v - p]) {
        alcancavel[v] = true;
        break;
      }
    }
  }
  return alcancavel[preco];
}

describe("gerarRodada — 200 por nível, oráculo DP", () => {
  for (const nivel of [1, 2] as NivelLojinha[]) {
    test(`nível ${nivel}: todo preço é pagável com as peças do nível (DP)`, () => {
      const rng = criarRng(600 + nivel);
      const pecas = pecasDoNivel(nivel);
      for (let i = 0; i < 200; i++) {
        const r = gerarRodada(nivel, rng);
        expect(r.preco).toBeGreaterThan(0);
        expect(Number.isInteger(r.preco)).toBe(true);
        expect(pagavelPorDP(r.preco, pecas), `preço impagável: ${r.preco}`).toBe(true);
        expect(r.pagamento).toBeUndefined();
      }
    });
  }

  test("nível 3: troco = pagamento − preço, SEMPRE > 0, opções únicas com a certa", () => {
    const rng = criarRng(999);
    for (let i = 0; i < 200; i++) {
      const r = gerarRodada(3, rng);
      expect(r.pagamento).toBeDefined();
      expect(r.pagamento!).toBeGreaterThan(r.preco);
      const troco = r.pagamento! - r.preco;
      expect(troco).toBeGreaterThan(0);
      expect(r.preco % 25).toBe(0);

      expect(r.opcoesTroco).toHaveLength(4);
      expect(new Set(r.opcoesTroco).size).toBe(4);
      expect(r.opcoesTroco).toContain(troco);
      for (const o of r.opcoesTroco!) expect(o).toBeGreaterThan(0);
    }
  });
});

describe("máquina do caixa", () => {
  test("estourar o preço NÃO adiciona a peça (ela volta sozinha)", () => {
    const { pilha, estourou } = tocarPeca([500], 1000, 700);
    expect(estourou).toBe(true);
    expect(pilha).toEqual([500]);
  });

  test("soma exata fica; devolver tira; posição inválida é no-op", () => {
    const a = tocarPeca([], 500, 700);
    expect(a).toEqual({ pilha: [500], estourou: false });
    const b = tocarPeca(a.pilha, 200, 700);
    expect(somaDe(b.pilha)).toBe(700);

    expect(devolverPeca(b.pilha, 0)).toEqual([200]);
    expect(devolverPeca(b.pilha, 5)).toBe(b.pilha);
    expect(devolverPeca(b.pilha, -1)).toBe(b.pilha);
  });
});

describe("formatação em centavos inteiros", () => {
  test("valores exatos", () => {
    expect(formatar(200)).toBe("R$ 2");
    expect(formatar(1875)).toBe("R$ 18,75");
    expect(formatar(25)).toBe("R$ 0,25");
    expect(formatar(1050)).toBe("R$ 10,50");
  });
});

describe("progressão", () => {
  test("sobe até 3 e para; fase tem 8 compras", () => {
    expect(proximoNivelLojinha(1)).toBe(2);
    expect(proximoNivelLojinha(3)).toBe(3);
    expect(COMPRAS_POR_FASE).toBe(8);
  });
});
