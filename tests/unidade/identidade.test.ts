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

  test("catálogo default COMPLETO: todos os 19 pares nome/descrição byte a byte", () => {
    // snapshot integral (review PR #46): QUALQUER texto do catálogo que mudar
    // quebra aqui — não só os que citam a mascote
    const pares = criarJogos(IDENTIDADE).map((j) => [j.id, j.nome, j.descricao]);
    expect(pares).toEqual([
      ["atelie", "Ateliê da Manu", "Desenhar, pintar e colorir"],
      ["contas", "Foguete das Contas", "Contas de somar e tabuada"],
      ["memoria", "Jogo da Memória", "Encontre os pares"],
      ["labirinto", "Labirinto da Manu", "Guie a Manu até a estrela"],
      ["palavras", "Palavra Mágica", "Complete as palavras"],
      ["forca", "Forca da Manu", "Adivinhe a palavra"],
      ["relogio", "Relógio Mágico", "Que horas são?"],
      ["lojinha", "Lojinha da Manu", "Pague e receba o troco"],
      ["genius", "Genius dos Sons", "Escute e repita"],
      ["fracoes", "Pizza das Frações", "Leia, pinte e compare"],
      ["estados", "Estados do Brasil", "Ache no mapa"],
      ["tangram", "Tangram da Manu", "Monte as figuras"],
      ["damas", "Damas", "Jogue com alguém"],
      ["caca", "Caça-Números", "Pares, múltiplos e fatores"],
      ["ludo", "Ludo da Manu", "Corrida de dados"],
      ["cobras", "Cobras e Escadas", "Corrida ate o 100"],
      ["lig4", "Lig-4", "4 em linha, com a Manu"],
      ["mancala", "Mancala", "Semeie e colha"],
      ["rota", "Roda Romana", "Tres em linha na roda"],
    ]);
  });

  test("compartilhar deriva byte a byte no default", () => {
    expect(`desenho-${flexionar("do", "da")}-${IDENTIDADE.slug}.png`).toBe("desenho-da-manu.png");
    expect(`Desenho ${daMascote()}`).toBe("Desenho da Manu");
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

  test("Maria Clara (nome composto + apelido com acento) — catálogo inteiro flexiona", () => {
    expect(maria.tituloApp).toBe("Maria Clara Jogos");
    expect(maria.slug).toBe("cacau");
    expect(
      criarIdentidade({ nome: "José", apelido: "Zé", genero: "o" }).slug,
    ).toBe("ze");
    const nomes = criarJogos(maria).map((j) => j.nome);
    expect(nomes).toContain("Ateliê da Cacau");
    expect(nomes).toContain("Ludo da Cacau");
    const labirinto = criarJogos(maria).find((j) => j.id === "labirinto")!;
    expect(labirinto.descricao).toBe("Guie a Cacau até a estrela");
  });

  test("validação: vazio, gigante e apelido sem letra são rejeitados", () => {
    expect(() => criarIdentidade({ nome: "", apelido: "x", genero: "a" })).toThrow();
    expect(() => criarIdentidade({ nome: "  ", apelido: "x", genero: "a" })).toThrow();
    expect(() =>
      criarIdentidade({ nome: "a".repeat(21), apelido: "x", genero: "a" }),
    ).toThrow();
    // apelido só de emoji viraria "desenho-da-.png" (review PR #46)
    expect(() => criarIdentidade({ nome: "Ana", apelido: "👧", genero: "a" })).toThrow();
  });
});
