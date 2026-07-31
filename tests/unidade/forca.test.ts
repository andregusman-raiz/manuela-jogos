import { describe, expect, test } from "vitest";
import {
  ERROS_MAXIMOS,
  PALAVRAS_POR_FASE,
  avancar,
  base,
  gerarFase,
  palavraAtual,
  tentar,
} from "@/lib/forca/motor";
import type { EstadoForca } from "@/lib/forca/motor";

/** Ganha a palavra atual tentando as letras dela (oráculo do teste). */
function ganharAtual(estado: EstadoForca): EstadoForca {
  for (const c of new Set([...palavraAtual(estado).palavra].map((x) => base(x)))) {
    estado = tentar(estado, c);
  }
  expect(estado.situacao).toBe("ganhou-palavra");
  return estado;
}

/** Perde a palavra atual errando 6 letras que não existem nela. */
function perderAtual(estado: EstadoForca): EstadoForca {
  const bases = new Set([...palavraAtual(estado).palavra].map((c) => base(c)));
  let erradas = 0;
  for (const letra of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") {
    if (erradas === ERROS_MAXIMOS) break;
    if (bases.has(letra)) continue;
    estado = tentar(estado, letra);
    erradas++;
  }
  expect(estado.situacao).toBe("perdeu-palavra");
  return estado;
}

describe("acentos de graça (NFD)", () => {
  test("base() derruba diacríticos: Ã→A, Ç→C, É→E", () => {
    expect(base("Ã")).toBe("A");
    expect(base("Ç")).toBe("C");
    expect(base("é")).toBe("E");
  });

  test("tocar A revela o Ã de AVIÃO; tocar C revela o Ç de PALHAÇO", () => {
    // fase sintética com a palavra desejada na frente
    const comPalavra = (palavra: string): EstadoForca => ({
      nivel: 2,
      fila: [{ palavra, emoji: "✈️" }],
      indice: 0,
      usadas: [],
      erros: 0,
      ganhas: 0,
      jogadas: 0,
      situacao: "jogando",
    });

    let aviao = comPalavra("AVIÃO");
    for (const letra of ["A", "V", "I", "O"]) aviao = tentar(aviao, letra);
    expect(aviao.situacao).toBe("ganhou-palavra"); // o Ã veio de graça com A, O com Õ? não: O revela O e Ã já veio

    let palhaco = comPalavra("PALHAÇO");
    for (const letra of ["P", "A", "L", "H", "C", "O"]) palhaco = tentar(palhaco, letra);
    expect(palhaco.situacao).toBe("ganhou-palavra"); // Ç veio com C
  });
});

describe("máquina da palavra", () => {
  test("letra repetida e letra inválida são no-op (mesma referência)", () => {
    let estado = gerarFase(1, 5);
    estado = tentar(estado, "A");
    expect(tentar(estado, "A")).toBe(estado);
    expect(tentar(estado, "á")).toBe(estado); // mesma base
    expect(tentar(estado, "1")).toBe(estado);
    expect(tentar(estado, "")).toBe(estado);
  });

  test("6º erro revela a palavra: jogadas avança, ganhas não", () => {
    let estado = gerarFase(1, 7);
    estado = perderAtual(estado);
    expect(estado.jogadas).toBe(1);
    expect(estado.ganhas).toBe(0);
    // toque depois de perdida é no-op até avancar()
    expect(tentar(estado, "Z")).toBe(estado);
  });

  test("a fase fecha em 6 jogadas MESMO perdendo todas (nunca trava)", () => {
    let estado = gerarFase(1, 11);
    for (let i = 0; i < PALAVRAS_POR_FASE; i++) {
      estado = perderAtual(estado);
      estado = avancar(estado);
    }
    expect(estado.situacao).toBe("fase-completa");
    expect(estado.jogadas).toBe(PALAVRAS_POR_FASE);
    expect(estado.ganhas).toBe(0);
  });

  test("ganhar todas fecha com 6 ganhas", () => {
    let estado = gerarFase(1, 13);
    for (let i = 0; i < PALAVRAS_POR_FASE; i++) {
      estado = ganharAtual(estado);
      estado = avancar(estado);
    }
    expect(estado.situacao).toBe("fase-completa");
    expect(estado.ganhas).toBe(PALAVRAS_POR_FASE);
  });

  test("misto: perder no meio não impede o confete no fim", () => {
    let estado = gerarFase(2, 17);
    estado = ganharAtual(estado);
    estado = avancar(estado);
    estado = perderAtual(estado);
    estado = avancar(estado);
    for (let i = 2; i < PALAVRAS_POR_FASE; i++) {
      estado = ganharAtual(estado);
      estado = avancar(estado);
    }
    expect(estado.situacao).toBe("fase-completa");
    expect(estado.ganhas).toBe(5);
    expect(estado.jogadas).toBe(6);
  });
});

describe("gerarFase", () => {
  test("100 seeds: 6 palavras únicas do nível pedido", () => {
    for (const nivel of [1, 2] as const) {
      for (let seed = 0; seed < 100; seed++) {
        const { fila } = gerarFase(nivel, seed);
        expect(fila).toHaveLength(PALAVRAS_POR_FASE);
        expect(new Set(fila.map((p) => p.palavra)).size).toBe(PALAVRAS_POR_FASE);
      }
    }
  });
});
