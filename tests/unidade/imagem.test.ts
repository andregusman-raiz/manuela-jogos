import { describe, expect, test } from "vitest";
import { caixaUtil, fundoClaro, removerFundo, temAlpha, type Pixels } from "@/lib/imagem";

/** Monta Pixels de um "desenho" ASCII: '.' branco, '#' cor, 'o' branco interno. */
function pixelsDe(linhas: string[]): Pixels {
  const altura = linhas.length;
  const largura = linhas[0].length;
  const dados = new Uint8ClampedArray(largura * altura * 4);
  for (let y = 0; y < altura; y++) {
    for (let x = 0; x < largura; x++) {
      const i = (y * largura + x) * 4;
      const c = linhas[y][x];
      if (c === "#") {
        dados[i] = 200;
        dados[i + 1] = 60;
        dados[i + 2] = 60;
      } else {
        // '.' e 'o' são brancos — 'o' só marca a intenção (interno)
        dados[i] = 255;
        dados[i + 1] = 255;
        dados[i + 2] = 255;
      }
      dados[i + 3] = 255;
    }
  }
  return { dados, largura, altura };
}

function alphaEm(p: Pixels, x: number, y: number): number {
  return p.dados[(y * p.largura + x) * 4 + 3];
}

describe("removerFundo (flood-fill dos cantos)", () => {
  test("apaga o branco da borda e PRESERVA o branco interno cercado", () => {
    const p = pixelsDe([
      "..........",
      ".########.",
      ".#oo###o#.",
      ".########.",
      "..........",
    ]);
    removerFundo(p);
    expect(alphaEm(p, 0, 0)).toBe(0); // canto virou transparente
    expect(alphaEm(p, 5, 0)).toBe(0); // borda de cima
    expect(alphaEm(p, 2, 2)).toBe(255); // olho branco INTERNO ficou
    expect(alphaEm(p, 7, 2)).toBe(255);
    expect(alphaEm(p, 4, 2)).toBe(255); // cor nunca é tocada
  });

  test("antisserrilha a borda: opaco com 2+ vizinhos transparentes vira alpha 140", () => {
    const p = pixelsDe(["....", ".##.", ".##.", "...."]);
    removerFundo(p);
    // os 4 pixels do quadrado têm 2 vizinhos transparentes cada (canto)
    expect(alphaEm(p, 1, 1)).toBe(140);
    expect(alphaEm(p, 2, 2)).toBe(140);
  });

  test("pior caso conectado (tudo branco) roda e zera tudo", () => {
    const p = pixelsDe(Array.from({ length: 64 }, () => ".".repeat(64)));
    removerFundo(p);
    expect(alphaEm(p, 32, 32)).toBe(0);
    expect(caixaUtil(p)).toBeNull(); // imagem toda transparente → caixa nula
  });
});

describe("mutation-killers do review PR #52", () => {
  test("pixel 240 NÃO é fundo (limiar é 245 — mutante 200 morre aqui)", () => {
    const p = pixelsDe(["...", ".#.", "..."]);
    // pinta um pixel de borda com cinza 240 (quase branco, mas abaixo do limiar)
    p.dados[0] = 240;
    p.dados[1] = 240;
    p.dados[2] = 240;
    removerFundo(p);
    // não virou fundo (o antisserrilhado legítimo pode dar 140 — nunca 0)
    expect(alphaEm(p, 0, 0)).toBeGreaterThan(0);
  });

  test("borda 60% clara NÃO é fundo claro (limiar 70% — mutantes 50%/90% morrem)", () => {
    // contorno de 10 px: 6 brancos (60%) → NÃO é fundo claro
    const p = pixelsDe(["####", "....", "...."]);
    expect(fundoClaro(p)).toBe(false);
    // contorno de 10 px: 9 brancos (90%) → é
    const q = pixelsDe(["....", "#...", "...."]);
    expect(fundoClaro(q)).toBe(true);
  });
});

describe("fundoClaro / temAlpha / caixaUtil", () => {
  test("borda majoritariamente branca → true; borda colorida → false", () => {
    expect(fundoClaro(pixelsDe(["....", ".##.", "...."]))).toBe(true);
    expect(fundoClaro(pixelsDe(["####", "#..#", "####"]))).toBe(false);
  });

  test("temAlpha detecta transparência pré-existente", () => {
    const p = pixelsDe(["..", ".."]);
    expect(temAlpha(p)).toBe(false);
    p.dados[3] = 0;
    expect(temAlpha(p)).toBe(true);
  });

  test("caixaUtil recorta o conteúdo", () => {
    const p = pixelsDe(["......", ".##...", ".###..", "......"]);
    removerFundo(p);
    expect(caixaUtil(p)).toEqual({ x: 1, y: 1, largura: 3, altura: 2 });
  });
});
