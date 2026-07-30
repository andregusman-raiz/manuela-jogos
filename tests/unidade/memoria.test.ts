import { describe, expect, test } from "vitest";
import {
  PARES_POR_NIVEL,
  criarRng,
  criarTabuleiro,
  fecharCartas,
  proximoNivelMemoria,
  tocarCarta,
} from "@/lib/memoria/motor";
import type { EstadoTabuleiro, NivelMemoria } from "@/lib/memoria/tipos";

function acharPar(estado: EstadoTabuleiro): [number, number] {
  const vivas = estado.cartas.filter((c) => !estado.removidas.includes(c.id));
  for (const a of vivas) {
    const b = vivas.find((c) => c.id !== a.id && c.parId === a.parId);
    if (b) return [a.id, b.id];
  }
  throw new Error("tabuleiro sem par vivo");
}

function acharDiferentes(estado: EstadoTabuleiro): [number, number] {
  const vivas = estado.cartas.filter((c) => !estado.removidas.includes(c.id));
  const a = vivas[0];
  const b = vivas.find((c) => c.parId !== a.parId)!;
  return [a.id, b.id];
}

describe("criarTabuleiro — SPEC §4.2", () => {
  for (const nivel of [1, 2, 3] as NivelMemoria[]) {
    test(`nível ${nivel}: ${PARES_POR_NIVEL[nivel]} pares íntegros`, () => {
      const rng = criarRng(500 + nivel);
      const t = criarTabuleiro(nivel, rng);
      expect(t.cartas).toHaveLength(PARES_POR_NIVEL[nivel] * 2);
      // todo parId aparece exatamente 2 vezes
      const porPar = new Map<number, number>();
      for (const c of t.cartas) porPar.set(c.parId, (porPar.get(c.parId) ?? 0) + 1);
      for (const n of porPar.values()) expect(n).toBe(2);
    });
  }

  test("nível 3: resultados ÚNICOS em 100 tabuleiros (senão 3×4 casa com 2×6)", () => {
    for (let seed = 0; seed < 100; seed++) {
      const t = criarTabuleiro(3, criarRng(seed));
      const resultados = t.cartas.filter((c) => c.tipo === "resultado").map((c) => c.face);
      expect(new Set(resultados).size).toBe(resultados.length);
      // toda conta bate com o resultado do próprio par (oráculo do teste)
      for (const conta of t.cartas.filter((c) => c.tipo === "conta")) {
        const [a, , b] = conta.face.split(" ");
        const resultado = t.cartas.find((c) => c.tipo === "resultado" && c.parId === conta.parId)!;
        expect(Number(resultado.face)).toBe(Number(a) * Number(b));
      }
    }
  });

  test("níveis 1-2 usam emoji dos dois lados", () => {
    const t = criarTabuleiro(1, criarRng(9));
    for (const c of t.cartas) expect(c.tipo).toBe("emoji");
  });

  test("nível 3: conta e resultado do MESMO parId casam (faces diferentes!)", () => {
    // mata a mutação parId -> igualdade de face, que deixaria o nível 3
    // impossível com todos os outros testes verdes
    const t = criarTabuleiro(3, criarRng(77));
    const conta = t.cartas.find((c) => c.tipo === "conta")!;
    const resultado = t.cartas.find((c) => c.tipo === "resultado" && c.parId === conta.parId)!;
    expect(conta.face).not.toBe(resultado.face);

    const depois = tocarCarta(tocarCarta(t, conta.id), resultado.id);
    expect(depois.removidas).toEqual(expect.arrayContaining([conta.id, resultado.id]));
    expect(depois.tentativas).toBe(1);
  });
});

describe("máquina do tabuleiro — toques concorrentes (SPEC §4.2)", () => {
  test("terceira carta durante resolvendo é IGNORADA (mesma referência)", () => {
    const t = criarTabuleiro(1, criarRng(21));
    const [a, b] = acharDiferentes(t);
    const aberto = tocarCarta(t, a);
    const resolvendo = tocarCarta(aberto, b);
    expect(resolvendo.fase).toBe("resolvendo");
    expect(resolvendo.tentativas).toBe(1);

    const terceira = t.cartas.find((c) => c.id !== a && c.id !== b)!.id;
    expect(tocarCarta(resolvendo, terceira)).toBe(resolvendo);
  });

  test("tocar a mesma carta duas vezes não conta segunda revelação", () => {
    const t = criarTabuleiro(1, criarRng(22));
    const aberto = tocarCarta(t, t.cartas[0].id);
    expect(aberto.fase).toBe("uma-aberta");
    expect(tocarCarta(aberto, t.cartas[0].id)).toBe(aberto);
    expect(aberto.tentativas).toBe(0);
  });

  test("par certo remove as duas; fechar só age em resolvendo", () => {
    const t = criarTabuleiro(1, criarRng(23));
    const [a, b] = acharPar(t);
    const depois = tocarCarta(tocarCarta(t, a), b);
    expect(depois.fase).toBe("livre");
    expect(depois.removidas).toEqual([a, b]);
    expect(depois.tentativas).toBe(1);
    // fechar fora de resolvendo é no-op
    expect(fecharCartas(depois)).toBe(depois);
  });

  test("par errado fecha após o evento fechar e mantém a contagem", () => {
    const t = criarTabuleiro(1, criarRng(24));
    const [a, b] = acharDiferentes(t);
    const resolvendo = tocarCarta(tocarCarta(t, a), b);
    const fechado = fecharCartas(resolvendo);
    expect(fechado.fase).toBe("livre");
    expect(fechado.abertas).toEqual([]);
    expect(fechado.removidas).toEqual([]);
    expect(fechado.tentativas).toBe(1);
  });

  test("parear tudo completa a fase e o tabuleiro trava", () => {
    let estado = criarTabuleiro(1, criarRng(25));
    for (let i = 0; i < PARES_POR_NIVEL[1]; i++) {
      const [a, b] = acharPar(estado);
      estado = tocarCarta(tocarCarta(estado, a), b);
    }
    expect(estado.fase).toBe("completa");
    expect(estado.tentativas).toBe(PARES_POR_NIVEL[1]);
    expect(tocarCarta(estado, estado.cartas[0].id)).toBe(estado);
  });
});

describe("progressão", () => {
  test("próximo nível sobe até 3 e para", () => {
    expect(proximoNivelMemoria(1)).toBe(2);
    expect(proximoNivelMemoria(2)).toBe(3);
    expect(proximoNivelMemoria(3)).toBe(3);
  });
});
