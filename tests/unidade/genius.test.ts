import { describe, expect, test } from "vitest";
import {
  BOTOES,
  SEQUENCIA_ALVO,
  TAMANHO_INICIAL,
  avancarReplay,
  criarPartida,
  ouvir,
} from "@/lib/genius/motor";
import type { EstadoGenius } from "@/lib/genius/motor";

/** Consome o replay inteiro até a vez da criança. */
function ateOuvindo(estado: EstadoGenius): EstadoGenius {
  let e = estado;
  for (let i = 0; i < SEQUENCIA_ALVO + 1 && e.fase === "mostrando"; i++) e = avancarReplay(e);
  expect(e.fase).toBe("ouvindo");
  return e;
}

/** Repete o prefixo inteiro corretamente. */
function repetirCerto(estado: EstadoGenius): EstadoGenius {
  let e = estado;
  const { tamanho } = e;
  for (let i = 0; i < tamanho; i++) e = ouvir(e, e.sequencia[e.posicao]);
  return e;
}

describe("máquina do Genius — SPEC onda 2 §3.4", () => {
  test("partida com seed é determinística e começa com 2, mostrando", () => {
    const a = criarPartida(42);
    const b = criarPartida(42);
    expect(a.sequencia).toEqual(b.sequencia);
    expect(a.sequencia).toHaveLength(SEQUENCIA_ALVO);
    for (const item of a.sequencia) {
      expect(item).toBeGreaterThanOrEqual(0);
      expect(item).toBeLessThan(BOTOES);
    }
    expect(a.tamanho).toBe(TAMANHO_INICIAL);
    expect(a.fase).toBe("mostrando");
  });

  test("toque durante o replay é IGNORADO no motor (mesma referência)", () => {
    const partida = criarPartida(7);
    expect(ouvir(partida, 0)).toBe(partida);
    expect(ouvir(partida, 3)).toBe(partida);
  });

  test("o replay consome exatamente `tamanho` itens e vira ouvindo", () => {
    let e = criarPartida(9);
    e = avancarReplay(e);
    expect(e.fase).toBe("mostrando");
    expect(e.indiceReplay).toBe(1);
    e = avancarReplay(e);
    expect(e.fase).toBe("ouvindo");
    // avancar fora de mostrando: no-op por referência
    expect(avancarReplay(e)).toBe(e);
  });

  test("erro mantém o tamanho, zera a posição e volta a mostrar", () => {
    const e = ateOuvindo(criarPartida(11));
    const errado = (e.sequencia[0] + 1) % BOTOES;
    const depois = ouvir(e, errado);
    expect(depois.fase).toBe("mostrando");
    expect(depois.tamanho).toBe(TAMANHO_INICIAL);
    expect(depois.posicao).toBe(0);
    expect(depois.sequencia).toEqual(e.sequencia); // NUNCA encolhe nem muda
  });

  test("repetir certo cresce exatamente 1 e volta a mostrar", () => {
    let e = ateOuvindo(criarPartida(13));
    e = repetirCerto(e);
    expect(e.tamanho).toBe(TAMANHO_INICIAL + 1);
    expect(e.fase).toBe("mostrando");
    expect(e.indiceReplay).toBe(0);
  });

  test("completa aos 8 e trava tudo", () => {
    let e = criarPartida(17);
    while (e.fase !== "fase-completa") {
      e = ateOuvindo(e);
      e = repetirCerto(e);
    }
    expect(e.tamanho).toBe(SEQUENCIA_ALVO);
    expect(ouvir(e, e.sequencia[0])).toBe(e);
    expect(avancarReplay(e)).toBe(e);
  });

  test("erro no meio de uma rodada longa: o prefixo reapresentado é o MESMO", () => {
    let e = ateOuvindo(criarPartida(19));
    e = repetirCerto(e); // tamanho 3
    e = ateOuvindo(e);
    e = ouvir(e, e.sequencia[0]); // 1 certo
    const errado = (e.sequencia[e.posicao] + 1) % BOTOES;
    e = ouvir(e, errado);
    expect(e.tamanho).toBe(3);
    expect(e.fase).toBe("mostrando");
  });
});
