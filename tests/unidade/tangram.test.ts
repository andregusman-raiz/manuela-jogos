import { describe, expect, test } from "vitest";
import { SILHUETAS } from "@/lib/tangram/dados";
import { PECAS, TOLERANCIA_ENCAIXE, bboxDaPose, verificarEncaixe } from "@/lib/tangram/motor";

describe("encaixe — tolerâncias da SPEC", () => {
  const alvo = { peca: "q" as const, x: 100, y: 100, rotacao: 0, espelhado: false };

  test("exato aceita; 17px de distância rejeita; 15px aceita", () => {
    expect(verificarEncaixe("q", { x: 100, y: 100, rotacao: 0, espelhado: false }, alvo)).toBe(true);
    expect(verificarEncaixe("q", { x: 117, y: 100, rotacao: 0, espelhado: false }, alvo)).toBe(false);
    expect(verificarEncaixe("q", { x: 115, y: 100, rotacao: 0, espelhado: false }, alvo)).toBe(true);
    expect(TOLERANCIA_ENCAIXE).toBe(16);
  });

  test("quadrado aceita rotações equivalentes por simetria (0=90=180=270)", () => {
    for (const rotacao of [0, 90, 180, 270]) {
      expect(verificarEncaixe("q", { x: 100, y: 100, rotacao, espelhado: false }, alvo)).toBe(true);
    }
    expect(verificarEncaixe("q", { x: 100, y: 100, rotacao: 45, espelhado: false }, alvo)).toBe(
      false,
    );
  });

  test("triângulo NÃO aceita rotação errada (simetria 360)", () => {
    const alvoTri = { peca: "g1" as const, x: 100, y: 100, rotacao: 45, espelhado: false };
    expect(verificarEncaixe("g1", { x: 100, y: 100, rotacao: 45, espelhado: false }, alvoTri)).toBe(
      true,
    );
    expect(verificarEncaixe("g1", { x: 100, y: 100, rotacao: 135, espelhado: false }, alvoTri)).toBe(
      false,
    );
  });

  test("paralelogramo: espelho exigido rejeita não-espelhado E vice-versa", () => {
    const alvoEsp = { peca: "para" as const, x: 100, y: 100, rotacao: 0, espelhado: true };
    const alvoNao = { peca: "para" as const, x: 100, y: 100, rotacao: 0, espelhado: false };
    expect(verificarEncaixe("para", { x: 100, y: 100, rotacao: 0, espelhado: true }, alvoEsp)).toBe(
      true,
    );
    expect(verificarEncaixe("para", { x: 100, y: 100, rotacao: 0, espelhado: false }, alvoEsp)).toBe(
      false,
    );
    expect(verificarEncaixe("para", { x: 100, y: 100, rotacao: 0, espelhado: true }, alvoNao)).toBe(
      false,
    );
    // paralelogramo tem simetria 180
    expect(verificarEncaixe("para", { x: 100, y: 100, rotacao: 180, espelhado: false }, alvoNao)).toBe(
      true,
    );
  });

  test("peça errada no alvo certo rejeita", () => {
    expect(verificarEncaixe("m", { x: 100, y: 100, rotacao: 0, espelhado: false }, alvo)).toBe(
      false,
    );
  });
});

describe("silhuetas — invariantes anti-'silhueta inexistente' (SPEC pós-juízo)", () => {
  test("10 silhuetas; cada peça exatamente 1×; nomes únicos", () => {
    expect(SILHUETAS).toHaveLength(10);
    expect(new Set(SILHUETAS.map((s) => s.nome)).size).toBe(10);
    for (const s of SILHUETAS) {
      expect(s.alvos.map((a) => a.peca).sort()).toEqual([...PECAS].sort());
    }
  });

  test("centros distam >= 24px par a par (sete peças no mesmo ponto morrem)", () => {
    for (const s of SILHUETAS) {
      for (let i = 0; i < s.alvos.length; i++) {
        for (let j = i + 1; j < s.alvos.length; j++) {
          const d = Math.hypot(
            s.alvos[i].x - s.alvos[j].x,
            s.alvos[i].y - s.alvos[j].y,
          );
          expect(d, `${s.nome}: ${s.alvos[i].peca}×${s.alvos[j].peca} a ${d.toFixed(1)}px`).toBeGreaterThanOrEqual(24);
        }
      }
    }
  });

  test("a união dos bboxes é CONEXA (peças espalhadas morrem)", () => {
    for (const s of SILHUETAS) {
      const caixas = s.alvos.map((a) => bboxDaPose(a.peca, a));
      const encosta = (a: (typeof caixas)[0], b: (typeof caixas)[0]) =>
        a.minX <= b.maxX + 2 && b.minX <= a.maxX + 2 && a.minY <= b.maxY + 2 && b.minY <= a.maxY + 2;
      const visitadas = new Set<number>([0]);
      let mudou = true;
      while (mudou) {
        mudou = false;
        for (let i = 0; i < caixas.length; i++) {
          if (visitadas.has(i)) continue;
          for (const v of visitadas) {
            if (encosta(caixas[i], caixas[v])) {
              visitadas.add(i);
              mudou = true;
              break;
            }
          }
        }
      }
      expect(visitadas.size, `${s.nome} não é conexa`).toBe(s.alvos.length);
    }
  });

  test("tudo dentro do tabuleiro 200×200", () => {
    for (const s of SILHUETAS) {
      for (const a of s.alvos) {
        const b = bboxDaPose(a.peca, a);
        expect(b.minX, `${s.nome}/${a.peca}`).toBeGreaterThanOrEqual(0);
        expect(b.minY, `${s.nome}/${a.peca}`).toBeGreaterThanOrEqual(0);
        expect(b.maxX, `${s.nome}/${a.peca}`).toBeLessThanOrEqual(200);
        expect(b.maxY, `${s.nome}/${a.peca}`).toBeLessThanOrEqual(200);
      }
    }
  });
});
