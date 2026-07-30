import { describe, expect, it } from "vitest";
import { escalarDesenho, escalarOperacao, regioesDeOperacoes } from "@/lib/desenho/documento";
import type { Desenho, Operacao } from "@/lib/desenho/tipos";

/**
 * A exportação em alta resolução depende de escalar operações corretamente:
 * um erro aqui sai como desenho deslocado/deformado no PNG que vai para a
 * família — e ninguém testa manualmente cada tipo de operação.
 */
describe("escalarOperacao", () => {
  it("escala traço: pontos e espessura, preservando a força", () => {
    const op: Operacao = {
      kind: "traco",
      pincel: "pincel",
      cor: "#FF0000",
      espessura: 10,
      simetria: 2,
      pontos: [
        { x: 10, y: 20, f: 0.5 },
        { x: 30, y: 40, f: 1 },
      ],
    };
    const r = escalarOperacao(op, 2);
    if (r.kind !== "traco") throw new Error("mudou o tipo");
    expect(r.espessura).toBe(20);
    expect(r.simetria).toBe(2);
    expect(r.pontos).toEqual([
      { x: 20, y: 40, f: 0.5 },
      { x: 60, y: 80, f: 1 },
    ]);
    // não muta a original
    expect(op.pontos[0]).toEqual({ x: 10, y: 20, f: 0.5 });
  });

  it("escala carimbo, forma e balde nas coordenadas certas", () => {
    const carimbo = escalarOperacao(
      { kind: "carimbo", emoji: "⭐", x: 5, y: 6, tamanho: 48, giro: 0.3 },
      3,
    );
    if (carimbo.kind !== "carimbo") throw new Error("tipo");
    expect([carimbo.x, carimbo.y, carimbo.tamanho, carimbo.giro]).toEqual([15, 18, 144, 0.3]);

    const forma = escalarOperacao(
      {
        kind: "forma",
        forma: "coracao",
        cor: "#000",
        espessura: 8,
        preenchida: false,
        x1: 1,
        y1: 2,
        x2: 3,
        y2: 4,
      },
      10,
    );
    if (forma.kind !== "forma") throw new Error("tipo");
    expect([forma.x1, forma.y1, forma.x2, forma.y2, forma.espessura]).toEqual([10, 20, 30, 40, 80]);

    const balde = escalarOperacao({ kind: "balde", cor: "#0F0", x: 7, y: 9 }, 2);
    if (balde.kind !== "balde") throw new Error("tipo");
    expect([balde.x, balde.y]).toEqual([14, 18]);
  });

  it("fundo e região não têm coordenadas: passam intactos", () => {
    const fundo: Operacao = { kind: "fundo", cor: "#FFF" };
    const regiao: Operacao = { kind: "regiao", regiao: "cabeca", cor: "#F00" };
    expect(escalarOperacao(fundo, 5)).toBe(fundo);
    expect(escalarOperacao(regiao, 5)).toBe(regiao);
  });
});

describe("escalarDesenho", () => {
  it("escala dimensões e todas as operações", () => {
    const desenho: Desenho = {
      id: "x",
      criadoEm: 1,
      atualizadoEm: 2,
      largura: 100,
      altura: 200,
      colorir: "gato",
      operacoes: [
        { kind: "balde", cor: "#00F", x: 50, y: 50 },
        { kind: "regiao", regiao: "corpo", cor: "#0F0" },
      ],
    };
    const r = escalarDesenho(desenho, 2);
    expect([r.largura, r.altura]).toEqual([200, 400]);
    expect(r.colorir).toBe("gato");
    const balde = r.operacoes[0];
    if (balde.kind !== "balde") throw new Error("tipo");
    expect([balde.x, balde.y]).toEqual([100, 100]);
  });
});

describe("regioesDeOperacoes", () => {
  it("última pintura da região vence, ignorando os outros tipos", () => {
    const ops: Operacao[] = [
      { kind: "regiao", regiao: "cabeca", cor: "#111" },
      { kind: "fundo", cor: "#EEE" },
      { kind: "regiao", regiao: "corpo", cor: "#222" },
      { kind: "regiao", regiao: "cabeca", cor: "#333" },
    ];
    expect(regioesDeOperacoes(ops)).toEqual({ cabeca: "#333", corpo: "#222" });
  });

  it("sem regiões devolve mapa vazio", () => {
    expect(regioesDeOperacoes([])).toEqual({});
  });
});
