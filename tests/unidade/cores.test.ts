import { describe, expect, it } from "vitest";
import { CORES_EXTRAS, CORES_PRINCIPAIS, ESPESSURAS, FUNDOS } from "@/lib/cores";
import { PINCEIS_BASICOS, PINCEIS_ESPECIAIS, SIMETRIAS } from "@/lib/desenho/ferramentas";
import { CARIMBOS, FORMAS } from "@/lib/desenho/formas";

const HEX = /^#[0-9A-F]{6}$/;

describe("paleta", () => {
  it("usa hex válido em todas as cores", () => {
    for (const c of [...CORES_PRINCIPAIS, ...CORES_EXTRAS, ...FUNDOS]) {
      expect(c.hex, `${c.nome} com hex inválido`).toMatch(HEX);
    }
  });

  it("não repete cor na fita principal (a criança escolhe reconhecendo)", () => {
    const hexes = CORES_PRINCIPAIS.map((c) => c.hex);
    expect(new Set(hexes).size).toBe(hexes.length);
  });

  it("nomeia toda cor — é o rótulo do leitor de tela", () => {
    for (const c of [...CORES_PRINCIPAIS, ...CORES_EXTRAS]) {
      expect(c.nome.trim().length).toBeGreaterThan(2);
    }
  });

  it("mantém a fita com 24 cores (uma tela de rolagem, sem cansar)", () => {
    expect(CORES_PRINCIPAIS.length).toBe(24);
  });
});

describe("ferramentas", () => {
  it("oferece 4 espessuras crescentes, nunca número solto", () => {
    expect(ESPESSURAS.length).toBe(4);
    const ordenadas = [...ESPESSURAS].sort((a, b) => a - b);
    expect(ordenadas).toEqual([...ESPESSURAS]);
  });

  it("não repete tipo de pincel entre básicos e especiais", () => {
    const tipos = [...PINCEIS_BASICOS, ...PINCEIS_ESPECIAIS].map((p) => p.tipo);
    expect(new Set(tipos).size).toBe(tipos.length);
  });

  it("deixa os quatro pincéis do dia a dia na camada visível", () => {
    expect(PINCEIS_BASICOS.map((p) => p.tipo)).toEqual(["lapis", "pincel", "marcador", "giz"]);
  });

  it("oferece simetria 1, 2, 4 e 8", () => {
    expect(SIMETRIAS.map((s) => s.valor)).toEqual([1, 2, 4, 8]);
  });

  it("tem carimbos e formas suficientes para explorar", () => {
    expect(CARIMBOS.length).toBeGreaterThanOrEqual(12);
    expect(new Set(CARIMBOS).size).toBe(CARIMBOS.length);
    expect(FORMAS.length).toBeGreaterThanOrEqual(4);
  });
});
