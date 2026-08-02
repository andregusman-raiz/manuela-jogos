import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { criarJogos } from "@/lib/jogos";
import { PERFIS } from "@/lib/perfis";

describe("registro de perfis", () => {
  test("3 perfis com ids únicos e identidades derivadas", () => {
    expect(PERFIS.map((p) => p.id)).toEqual(["manuela", "leo", "gustavo"]);
    const leo = PERFIS[1];
    expect(leo.identidade.tituloApp).toBe("Leo Jogos");
    expect(leo.identidade.genero).toBe("o");
    expect(leo.identidade.slug).toBe("leo");
  });

  test("Gustavo: identidade derivada e catálogo flexionado", () => {
    const gustavo = PERFIS[2];
    expect(gustavo.identidade.tituloApp).toBe("Gustavo Jogos");
    expect(gustavo.identidade.slug).toBe("gustavo");
    const nomes = criarJogos(gustavo.identidade).map((j) => j.nome);
    expect(nomes).toContain("Ateliê do Gustavo");
  });

  test("catálogo flexiona para o Leo", () => {
    const nomes = criarJogos(PERFIS[1].identidade).map((j) => j.nome);
    expect(nomes).toContain("Ateliê do Leo");
    expect(nomes).toContain("Ludo do Leo");
    const lig4 = criarJogos(PERFIS[1].identidade).find((j) => j.id === "lig4")!;
    expect(lig4.descricao).toBe("4 em linha, com o Leo");
  });

  test("os assets de TODO perfil existem em public/ (corpo e avatar)", () => {
    const raiz = join(__dirname, "..", "..", "public");
    for (const perfil of PERFIS) {
      for (const figura of [perfil.corpo, perfil.avatar]) {
        expect(existsSync(join(raiz, figura.src)), `${perfil.id}: ${figura.src}`).toBe(true);
      }
    }
    // oráculo exato (review PR #48: >0 deixava dimensão errada passar)
    expect(PERFIS[0].corpo).toMatchObject({ largura: 642, altura: 1244 });
    expect(PERFIS[0].avatar).toMatchObject({ largura: 512, altura: 512 });
    expect(PERFIS[1].corpo).toMatchObject({ largura: 808, altura: 1147 });
    expect(PERFIS[1].avatar).toMatchObject({ largura: 512, altura: 512 });
    expect(PERFIS[2].corpo).toMatchObject({ largura: 541, altura: 1426 });
    expect(PERFIS[2].avatar).toMatchObject({ largura: 512, altura: 512 });
  });

  test("cada perfil tem cor de anel (rosa para a Manuela, azul para os meninos)", () => {
    expect(PERFIS.map((p) => p.anel)).toEqual([
      "ring-manu-rosa",
      "ring-manu-ceu",
      "ring-manu-ceu",
    ]);
  });

  test("compartilhar deriva do perfil ativo (Leo)", () => {
    const leo = PERFIS[1].identidade;
    expect(`desenho-${leo.genero === "a" ? "da" : "do"}-${leo.slug}.png`).toBe("desenho-do-leo.png");
  });
});
