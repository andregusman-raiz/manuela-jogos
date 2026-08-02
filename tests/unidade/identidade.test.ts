import { describe, expect, test } from "vitest";
import {
  IDENTIDADE,
  aMascote,
  comAMascote,
  criarIdentidade,
  daMascote,
  flexionar,
  paraAMascote,
  saudacao,
} from "@/lib/identidade";
import { criarJogos } from "@/lib/jogos";

describe("default Manuela — byte a byte com os textos publicados", () => {
  test("campos derivados", () => {
    expect(IDENTIDADE.tituloApp).toBe("Manuela Jogos");
    expect(IDENTIDADE.tituloCurto).toBe("Manu Jogos");
    expect(IDENTIDADE.descricaoApp).toBe(
      "Jogos para brincar, desenhar e pintar. Feito para a Manuela.",
    );
    expect(IDENTIDADE.altMascote).toBe("Manuela");
    expect(IDENTIDADE.slug).toBe("manu");
  });

  test("helpers no default", () => {
    expect(daMascote()).toBe("da Manu");
    expect(aMascote()).toBe("a Manu");
    expect(comAMascote()).toBe("com a Manu");
    expect(paraAMascote()).toBe("para a Manuela");
    expect(saudacao()).toBe("Bem-vinda!");
    expect(flexionar("Mestre", "Mestra")).toBe("Mestra");
  });

  test("catálogo default: nomes EXATOS de antes da refatoração", () => {
    const nomes = criarJogos(IDENTIDADE).map((j) => j.nome);
    expect(nomes).toContain("Ateliê da Manu");
    expect(nomes).toContain("Ludo da Manu");
    expect(nomes).toContain("Forca da Manu");
    expect(nomes).toContain("Cobras e Escadas"); // sem apelido: literal
    const lig4 = criarJogos(IDENTIDADE).find((j) => j.id === "lig4")!;
    expect(lig4.descricao).toBe("4 em linha, com a Manu");
  });
});

describe("outras identidades (contrato da fase 2)", () => {
  const theo = criarIdentidade({ nome: "Theo", apelido: "Theo", genero: "o" });
  const maria = criarIdentidade({ nome: "Maria Clara", apelido: "Cacau", genero: "a" });

  test("Theo (masculino)", () => {
    expect(theo.tituloApp).toBe("Theo Jogos");
    expect(theo.descricaoApp).toContain("Feito para o Theo.");
    expect(daMascote(theo)).toBe("do Theo");
    expect(comAMascote(theo)).toBe("com o Theo");
    expect(saudacao(theo)).toBe("Bem-vindo!");
    expect(flexionar("Mestre", "Mestra", theo)).toBe("Mestre");
    const nomes = criarJogos(theo).map((j) => j.nome);
    expect(nomes).toContain("Ludo do Theo");
    expect(nomes).toContain("Ateliê do Theo");
  });

  test("Maria Clara (nome composto + apelido com acento)", () => {
    expect(maria.tituloApp).toBe("Maria Clara Jogos");
    expect(maria.slug).toBe("cacau");
    expect(
      criarIdentidade({ nome: "José", apelido: "Zé", genero: "o" }).slug,
    ).toBe("ze");
  });

  test("validação: vazio e gigante são rejeitados", () => {
    expect(() => criarIdentidade({ nome: "", apelido: "x", genero: "a" })).toThrow();
    expect(() => criarIdentidade({ nome: "  ", apelido: "x", genero: "a" })).toThrow();
    expect(() =>
      criarIdentidade({ nome: "a".repeat(21), apelido: "x", genero: "a" }),
    ).toThrow();
  });
});
