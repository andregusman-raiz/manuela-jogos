import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { criarJogos } from "@/lib/jogos";
import { PERFIS } from "@/lib/perfis";

describe("registro de perfis", () => {
  test("2 perfis com ids únicos e identidades derivadas", () => {
    expect(PERFIS.map((p) => p.id)).toEqual(["manuela", "leo"]);
    const leo = PERFIS[1];
    expect(leo.identidade.tituloApp).toBe("Leo Jogos");
    expect(leo.identidade.genero).toBe("o");
    expect(leo.identidade.slug).toBe("leo");
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
        expect(figura.largura).toBeGreaterThan(0);
        expect(figura.altura).toBeGreaterThan(0);
      }
    }
  });
});
