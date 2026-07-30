import { describe, expect, test } from "vitest";
import { PALAVRAS } from "@/lib/palavras/dados";
import {
  RODADAS_POR_FASE,
  gerarFase,
  proximoNivelPalavras,
  responder,
} from "@/lib/palavras/motor";
import type { NivelPalavras } from "@/lib/palavras/tipos";

describe("banco de palavras — SPEC §4.4", () => {
  test("tem pelo menos 60 palavras", () => {
    expect(PALAVRAS.length).toBeGreaterThanOrEqual(60);
  });

  test("TODA palavra é exatamente a concatenação das suas sílabas", () => {
    for (const p of PALAVRAS) {
      expect(p.silabas.join(""), p.palavra).toBe(p.palavra);
      expect(p.palavra).toBe(p.palavra.toUpperCase());
      expect(p.emoji.length).toBeGreaterThan(0);
    }
  });

  test("nível 1 não tem acento nem cedilha", () => {
    for (const p of PALAVRAS.filter((x) => x.nivel === 1)) {
      expect(p.palavra, p.palavra).toMatch(/^[A-Z]+$/);
    }
  });

  test("sem palavra duplicada", () => {
    const nomes = PALAVRAS.map((p) => p.palavra);
    expect(new Set(nomes).size).toBe(nomes.length);
  });
});

describe("gerarFase — 100 fases por nível", () => {
  for (const nivel of [1, 2, 3] as NivelPalavras[]) {
    test(`nível ${nivel}: 8 palavras únicas, lacuna válida, 4 opções com a certa`, () => {
      for (let seed = 0; seed < 100; seed++) {
        const fase = gerarFase(nivel, seed);
        expect(fase).toHaveLength(RODADAS_POR_FASE);

        const palavras = fase.map((r) => r.palavra);
        expect(new Set(palavras).size, `seed ${seed}: palavra repetida`).toBe(palavras.length);

        for (const rodada of fase) {
          // a lacuna recorta exatamente a resposta
          expect(rodada.palavra.slice(rodada.inicio, rodada.fim)).toBe(rodada.resposta);
          expect(rodada.opcoes).toHaveLength(4);
          expect(new Set(rodada.opcoes).size).toBe(4);
          expect(rodada.opcoes).toContain(rodada.resposta);
          expect(responder(rodada, rodada.resposta)).toBe(true);
          for (const errada of rodada.opcoes.filter((o) => o !== rodada.resposta)) {
            expect(responder(rodada, errada)).toBe(false);
          }
        }
      }
    });
  }

  test("nível 3: a resposta é uma sílaba EXATA do campo silabas", () => {
    for (let seed = 0; seed < 100; seed++) {
      for (const rodada of gerarFase(3, seed)) {
        const dona = PALAVRAS.find((p) => p.palavra === rodada.palavra)!;
        expect(dona.silabas).toContain(rodada.resposta);
        // distratores vêm do banco (sílabas de outras palavras), tamanho ±1
        for (const opcao of rodada.opcoes.filter((o) => o !== rodada.resposta)) {
          expect(Math.abs(opcao.length - rodada.resposta.length)).toBeLessThanOrEqual(1);
          expect(PALAVRAS.some((p) => p.silabas.includes(opcao)), `${opcao} fora do banco`).toBe(
            true,
          );
        }
      }
    }
  });

  test("níveis 1 e 2 usam pools distintos por dificuldade", () => {
    for (let seed = 0; seed < 20; seed++) {
      for (const rodada of gerarFase(1, seed)) {
        expect(PALAVRAS.find((p) => p.palavra === rodada.palavra)!.nivel).toBe(1);
      }
      for (const rodada of gerarFase(2, seed)) {
        expect(PALAVRAS.find((p) => p.palavra === rodada.palavra)!.nivel).toBe(2);
      }
    }
  });
});

describe("progressão", () => {
  test("próximo nível sobe até 3 e para", () => {
    expect(proximoNivelPalavras(1)).toBe(2);
    expect(proximoNivelPalavras(2)).toBe(3);
    expect(proximoNivelPalavras(3)).toBe(3);
  });
});
