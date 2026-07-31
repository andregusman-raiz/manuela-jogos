import { describe, expect, test } from "vitest";
import {
  angulosDe,
  criarRng,
  gerarRodada,
  gradeDoNivel,
  proximoNivelRelogio,
  rotular,
} from "@/lib/relogio/motor";
import type { NivelRelogio } from "@/lib/relogio/motor";

describe("ângulos — o ponteiro de hora ANDA com os minutos", () => {
  test("valores exatos da SPEC", () => {
    expect(angulosDe(7, 30)).toEqual({ horaGraus: 225, minutoGraus: 180 });
    expect(angulosDe(3, 0)).toEqual({ horaGraus: 90, minutoGraus: 0 });
    expect(angulosDe(12, 0)).toEqual({ horaGraus: 0, minutoGraus: 0 });
    expect(angulosDe(6, 45)).toEqual({ horaGraus: 202.5, minutoGraus: 270 });
    expect(angulosDe(12, 55)).toEqual({ horaGraus: 27.5, minutoGraus: 330 });
  });
});

describe("gerarRodada — 200 por nível", () => {
  for (const nivel of [1, 2, 3] as NivelRelogio[]) {
    test(`nível ${nivel}: rótulo consistente, 4 opções únicas NA GRADE`, () => {
      const rng = criarRng(300 + nivel);
      const grade = new Set(gradeDoNivel(nivel));
      for (let i = 0; i < 200; i++) {
        const r = gerarRodada(nivel, rng);

        expect(r.hora).toBeGreaterThanOrEqual(1);
        expect(r.hora).toBeLessThanOrEqual(12);
        expect(grade.has(r.minuto), `minuto ${r.minuto} fora da grade`).toBe(true);
        expect(r.rotulo).toBe(rotular(r.hora, r.minuto));
        expect(r.angulos).toEqual(angulosDe(r.hora, r.minuto));

        expect(r.opcoes).toHaveLength(4);
        expect(new Set(r.opcoes).size).toBe(4);
        expect(r.opcoes).toContain(r.rotulo);
        for (const opcao of r.opcoes) {
          const [h, m] = opcao.split(":");
          expect(Number(h)).toBeGreaterThanOrEqual(1);
          expect(Number(h)).toBeLessThanOrEqual(12);
          expect(grade.has(Number(m)), `opção ${opcao} fora da grade do nível`).toBe(true);
        }
      }
    });
  }

  test("nível 1 é sempre hora cheia (m=0)", () => {
    const rng = criarRng(77);
    for (let i = 0; i < 100; i++) expect(gerarRodada(1, rng).minuto).toBe(0);
  });
});

describe("progressão", () => {
  test("sobe até 3 e para", () => {
    expect(proximoNivelRelogio(1)).toBe(2);
    expect(proximoNivelRelogio(3)).toBe(3);
  });
});
