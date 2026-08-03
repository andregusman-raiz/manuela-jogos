import { describe, expect, test } from "vitest";
import { criarIdentidade } from "@/lib/identidade";
import { IDS_RESERVADOS, MAXIMO_DINAMICOS, alocarId, anelPorGenero } from "@/lib/perfis";

describe("alocação de id (pura)", () => {
  test("slug livre fica como está; colisão sufixa -2, -3…", () => {
    expect(alocarId("sofia", new Set())).toBe("sofia");
    expect(alocarId("sofia", new Set(["sofia"]))).toBe("sofia-2");
    expect(alocarId("sofia", new Set(["sofia", "sofia-2"]))).toBe("sofia-3");
  });

  test("reservados ganham sufixo; prefixos perigosos trocam a base", () => {
    for (const reservado of IDS_RESERVADOS) {
      expect(alocarId(reservado, new Set())).toBe(`${reservado}-2`);
    }
    // "progresso*"/"rascunho*" colidiriam com chaves de memória: base troca
    expect(alocarId("progresso", new Set())).toBe("jogador");
    expect(alocarId("rascunho-da-sofia", new Set())).toBe("jogador");
    expect(alocarId("progresso", new Set(["jogador"]))).toBe("jogador-2");
  });

  test("base vazia ganha nome neutro", () => {
    expect(alocarId("", new Set())).toBe("jogador");
  });
});

describe("validação estendida (juiz B9 da SPEC de perfis)", () => {
  test("nome só-emoji reprova mesmo com apelido válido", () => {
    expect(() => criarIdentidade({ nome: "👧", apelido: "Sofi", genero: "a" })).toThrow();
  });

  test("não-latino passa DE VERDADE (review PR #52: régua é \\p{L}, não slug ascii)", () => {
    const sofia = criarIdentidade({ nome: "София", apelido: "София", genero: "a" });
    expect(sofia.tituloApp).toBe("София Jogos");
    expect(sofia.slug).toBe("jogador"); // slug ascii vazio cai no neutro
    expect(criarIdentidade({ nome: "José", apelido: "Zé", genero: "o" }).slug).toBe("ze");
  });
});

describe("constantes do registro", () => {
  test("limite e anel por gênero", () => {
    expect(MAXIMO_DINAMICOS).toBe(5);
    expect(anelPorGenero("a")).toBe("ring-manu-rosa");
    expect(anelPorGenero("o")).toBe("ring-manu-ceu");
  });
});
