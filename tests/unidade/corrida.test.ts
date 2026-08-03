import { describe, expect, test } from "vitest";
import { criarSorte } from "@/lib/dado";
import {
  ACELERACAO,
  COMPRIMENTO_CARRO,
  DT,
  LATERAL_MAXIMO,
  SEGMENTO,
  TETO_SEM_TOQUE_TICKS,
  TICKS_2_ESTRELAS,
  TICKS_3_ESTRELAS,
  VGRAMA,
  VMAX,
  comprimentoDaPista,
  criarCorrida,
  criarOponentes,
  direcaoTeste,
  estrelasNivel1,
  estrelasNivel2,
  naGrama,
  oponentesNaFrente,
  tick,
} from "@/lib/corrida/motor";
import type { EstadoCorrida, SegmentoPista } from "@/lib/corrida/motor";
import { PISTA_CORRIDA } from "@/lib/corrida/pista";

/** Oráculos do motor da Corrida (SPEC-jogos-corrida §2.2). */

function correndo(oponentes = criarCorrida(PISTA_CORRIDA, []).oponentes): EstadoCorrida {
  return { ...criarCorrida(PISTA_CORRIDA, oponentes), situacao: "correndo" };
}

function pistaReta(segmentos: number): SegmentoPista[] {
  return Array.from({ length: segmentos }, () => ({ curva: 0, elevacao: 0 }));
}

describe("física", () => {
  test("aceleração automática até o clamp VMAX", () => {
    let estado = correndo();
    for (let i = 0; i < 30; i++) estado = tick(estado, 0);
    expect(estado.velocidade).toBeCloseTo(30 * ACELERACAO * DT, 6);
    for (let i = 0; i < 300; i++) estado = tick(estado, 0);
    expect(estado.velocidade).toBe(VMAX);
  });

  test("curva empurra proporcional a curva·(v/VMAX); direção compensa; clamp lateral", () => {
    const pista: SegmentoPista[] = pistaReta(300).map(() => ({ curva: 0.5, elevacao: 0 }));
    let estado: EstadoCorrida = { ...correndo(), segmentos: pista, velocidade: VMAX };
    const antes = estado.lateral;
    estado = tick(estado, 0);
    expect(estado.lateral - antes).toBeCloseTo(0.5 * 1.6 * DT, 6);
    // direção -1 (esquerda) derruba o empurrão
    const comDirecao = tick({ ...estado }, -1);
    expect(comDirecao.lateral).toBeLessThan(tick({ ...estado }, 0).lateral);
    // clamp
    let extremo: EstadoCorrida = { ...estado, lateral: LATERAL_MAXIMO };
    extremo = tick(extremo, 1);
    expect(extremo.lateral).toBe(LATERAL_MAXIMO);
  });

  test("grama desacelera até VGRAMA, NUNCA para, e recupera ao voltar", () => {
    let estado: EstadoCorrida = { ...correndo(), lateral: 1.5, velocidade: VMAX };
    for (let i = 0; i < 120; i++) estado = tick(estado, 0);
    expect(estado.velocidade).toBe(VGRAMA);
    expect(estado.velocidade).toBeGreaterThan(0);
    estado = { ...estado, lateral: 0 };
    for (let i = 0; i < 60; i++) estado = tick(estado, 0);
    expect(estado.velocidade).toBeGreaterThan(VGRAMA);
  });

  test("naGrama é |lateral| > 1 estrito", () => {
    expect(naGrama(1)).toBe(false);
    expect(naGrama(1.01)).toBe(true);
    expect(naGrama(-1.01)).toBe(true);
  });
});

describe("estrelas (faixas EXATAS da SPEC)", () => {
  test("nível 1: 69.9s→3★, 70.1s→2★, 95.1s→1★", () => {
    expect(estrelasNivel1(Math.round(69.9 * 60))).toBe(3);
    expect(estrelasNivel1(TICKS_3_ESTRELAS)).toBe(3);
    expect(estrelasNivel1(TICKS_3_ESTRELAS + 1)).toBe(2);
    expect(estrelasNivel1(TICKS_2_ESTRELAS)).toBe(2);
    expect(estrelasNivel1(TICKS_2_ESTRELAS + 1)).toBe(1);
  });

  test("nível 2: terminar=1★; em 1º=2★; em 1º e ≤70s=3★ — clamp 3, sem 4ª", () => {
    expect(estrelasNivel2(100 * 60, false)).toBe(1);
    expect(estrelasNivel2(80 * 60, true)).toBe(2);
    expect(estrelasNivel2(60 * 60, true)).toBe(3);
    expect(estrelasNivel2(1, true)).toBe(3); // nunca 4
  });
});

describe("oponentes e colisão", () => {
  test("determinísticos por semente: mesma semente 2× = mesmos oponentes", () => {
    const a = criarOponentes(criarSorte(42));
    const b = criarOponentes(criarSorte(42));
    expect(a).toEqual(b);
    expect(a.map((o) => o.posicao)).toEqual([1500, 3000, 4500]);
    for (const o of a) {
      expect(o.base).toBeGreaterThanOrEqual(0.8 * VMAX);
      expect(o.base).toBeLessThanOrEqual(0.92 * VMAX);
      expect(Math.abs(o.lateral)).toBeLessThanOrEqual(0.6);
    }
  });

  test("encostar num oponente À FRENTE limita a velocidade à dele", () => {
    const oponentes = [{ posicao: 60, lateral: 0, base: 400, velocidade: 400 }];
    let estado: EstadoCorrida = {
      ...correndo(oponentes),
      velocidade: VMAX,
      lateral: 0,
      posicao: 0,
    };
    estado = tick(estado, 0);
    expect(estado.velocidade).toBeLessThanOrEqual(estado.oponentes[0].velocidade);
  });

  test("regressão do bug do juiz: oponente ATRÁS (-900 u) NÃO limita", () => {
    const oponentes = [{ posicao: 100, lateral: 0, base: 400, velocidade: 400 }];
    let estado: EstadoCorrida = {
      ...correndo(oponentes),
      velocidade: VMAX,
      lateral: 0,
      posicao: 1000, // oponente 900 u ATRÁS
    };
    estado = tick(estado, 0);
    expect(estado.velocidade).toBe(VMAX);
  });

  test("desviar (|Δlateral| ≥ 0.3) passa sem limite", () => {
    const oponentes = [{ posicao: 60, lateral: 0.5, base: 400, velocidade: 400 }];
    let estado: EstadoCorrida = { ...correndo(oponentes), velocidade: VMAX, lateral: 0 };
    estado = tick(estado, 0);
    expect(estado.velocidade).toBe(VMAX);
  });

  test("rubber-band dois sentidos: atrás de todos ×0.95; disparado ×1.05", () => {
    const base = 1000;
    const fazOponentes = () => [
      { posicao: 5000, lateral: 0, base, velocidade: base },
      { posicao: 6000, lateral: 0, base, velocidade: base },
    ];
    // jogador atrás do último
    let atras: EstadoCorrida = { ...correndo(fazOponentes()), posicao: 0 };
    atras = tick(atras, 0);
    expect(atras.oponentes[0].velocidade).toBeCloseTo(base * 0.95, 6);
    // jogador mais de 3000 u à frente do primeiro
    let frente: EstadoCorrida = { ...correndo(fazOponentes()), posicao: 9500 };
    frente = tick(frente, 0);
    expect(frente.oponentes[0].velocidade).toBeCloseTo(base * 1.05, 6);
    // no meio: base
    let meio: EstadoCorrida = { ...correndo(fazOponentes()), posicao: 5500 };
    meio = tick(meio, 0);
    expect(meio.oponentes[0].velocidade).toBeCloseTo(base, 6);
  });
});

describe("teoremas de produto (§2.1)", () => {
  test("SEM TOQUE NENHUM a corrida sempre termina em ≤ 10 500 ticks (175 s)", () => {
    let estado = correndo();
    let t = 0;
    for (; t < TETO_SEM_TOQUE_TICKS && estado.situacao === "correndo"; t++) {
      estado = tick(estado, 0);
    }
    expect(estado.situacao).toBe("fim");
    expect(estado.estrelas).toBeGreaterThanOrEqual(1); // terminar sempre vale 1★
  });

  test("pior caso teórico: 100% na grama ainda termina dentro do teto", () => {
    // trava o carro na grama com lateral máximo numa pista reta do mesmo tamanho
    const pista = pistaReta(PISTA_CORRIDA.length);
    let estado: EstadoCorrida = { ...correndo(), segmentos: pista, lateral: LATERAL_MAXIMO };
    let t = 0;
    for (; t < TETO_SEM_TOQUE_TICKS && estado.situacao === "correndo"; t++) {
      estado = tick(estado, 0);
    }
    expect(estado.situacao).toBe("fim");
  });

  test("o controlador compartilhado (direcaoTeste) completa o nível 1 com 3★", () => {
    let estado = correndo();
    for (let t = 0; t < TICKS_3_ESTRELAS + 1 && estado.situacao === "correndo"; t++) {
      estado = tick(estado, direcaoTeste(estado.lateral));
    }
    expect(estado.situacao).toBe("fim");
    expect(estado.estrelas).toBe(3);
    expect(estado.tempoTicks).toBeLessThanOrEqual(TICKS_3_ESTRELAS);
  });

  test("mesmo roteiro 2× = mesmo estado final (determinismo, nível 2 semente 42)", () => {
    const roda = () => {
      let estado = correndo(criarOponentes(criarSorte(42)));
      for (let t = 0; t < 8000 && estado.situacao === "correndo"; t++) {
        estado = tick(estado, direcaoTeste(estado.lateral));
      }
      return estado;
    };
    const a = roda();
    const b = roda();
    expect(a).toEqual(b);
    expect(a.situacao).toBe("fim");
  });
});

describe("fuzz (100 corridas seeded)", () => {
  test("direção aleatória mantém invariantes e posição monotônica", () => {
    for (let semente = 1; semente <= 100; semente++) {
      const sorte = criarSorte(semente);
      let estado = correndo(semente % 2 === 0 ? criarOponentes(criarSorte(semente)) : []);
      let direcao: -1 | 0 | 1 = 0;
      let valido = true;
      let anterior = 0;
      for (let t = 0; t < TETO_SEM_TOQUE_TICKS && estado.situacao === "correndo"; t++) {
        if (t % 20 === 0) direcao = ([-1, 0, 1] as const)[Math.floor(sorte() * 3)];
        estado = tick(estado, direcao);
        valido =
          valido &&
          Number.isFinite(estado.lateral) &&
          Math.abs(estado.lateral) <= LATERAL_MAXIMO &&
          estado.velocidade >= 0 &&
          estado.velocidade <= VMAX &&
          estado.posicao >= anterior;
        anterior = estado.posicao;
      }
      expect(valido, `semente ${semente} violou invariante`).toBe(true);
      expect(estado.situacao, `semente ${semente} não terminou`).toBe("fim");
    }
  });
});

describe("helpers", () => {
  test("comprimento e contagem de oponentes à frente", () => {
    expect(comprimentoDaPista(PISTA_CORRIDA)).toBe(300 * SEGMENTO);
    const estado = correndo([
      { posicao: 100, lateral: 0, base: 1, velocidade: 1 },
      { posicao: 900, lateral: 0, base: 1, velocidade: 1 },
    ]);
    expect(oponentesNaFrente({ ...estado, posicao: 500 })).toBe(1);
  });

  test("colisão na FRONTEIRA exata (medida pós-avanço do oponente): 80 limita, 80+ε não", () => {
    // a checagem usa a posição NOVA do oponente vs a ATUAL do jogador;
    // jogador atrás de todos ⇒ rubber-band: o oponente anda a base·0.95
    const faz = (distanciaAposAvanco: number) => {
      const base = 100;
      const oponentes = [
        { posicao: distanciaAposAvanco - base * 0.95 * DT, lateral: 0, base, velocidade: base },
      ];
      let estado: EstadoCorrida = {
        ...correndo(oponentes),
        posicao: 0,
        velocidade: VMAX,
        lateral: 0,
      };
      estado = tick(estado, 0);
      return estado.velocidade;
    };
    expect(faz(COMPRIMENTO_CARRO)).toBeLessThan(VMAX); // exatamente 80: limita
    expect(faz(COMPRIMENTO_CARRO + 0.01)).toBe(VMAX); // 80+ε: livre
  });

  test("dois oponentes encostados: vale o MAIS lento (min)", () => {
    const oponentes = [
      { posicao: 50, lateral: 0, base: 700, velocidade: 700 },
      { posicao: 70, lateral: 0.1, base: 500, velocidade: 500 },
    ];
    let estado: EstadoCorrida = { ...correndo(oponentes), posicao: 0, velocidade: VMAX, lateral: 0 };
    estado = tick(estado, 0);
    expect(estado.velocidade).toBeLessThanOrEqual(estado.oponentes[1].velocidade);
  });

  test("anti-atravessamento (review B1): 600 ticks encostado e o vão NUNCA fecha", () => {
    const base = 900;
    const oponentes = [{ posicao: 80, lateral: 0, base, velocidade: base }];
    let estado: EstadoCorrida = { ...correndo(oponentes), posicao: 0, velocidade: VMAX, lateral: 0 };
    let vaoMinimo = Infinity;
    for (let t = 0; t < 600; t++) {
      estado = tick(estado, 0);
      vaoMinimo = Math.min(vaoMinimo, estado.oponentes[0].posicao - estado.posicao);
    }
    expect(vaoMinimo, "o jogador atravessou o fantasma").toBeGreaterThan(0);
    expect(estado.velocidade).toBeLessThanOrEqual(base);
  });

  test("chegada no MESMO tick: conta para a criança (regra registrada no review)", () => {
    const comprimento = comprimentoDaPista(PISTA_CORRIDA);
    const oponentes = [{ posicao: comprimento - 8, lateral: 0.6, base: 960, velocidade: 960 }];
    let estado: EstadoCorrida = {
      ...correndo(oponentes),
      posicao: comprimento - 10,
      velocidade: VMAX,
      lateral: 0,
    };
    estado = tick(estado, 0); // os dois cruzam neste tick
    expect(estado.situacao).toBe("fim");
    expect(estado.estrelas).toBeGreaterThanOrEqual(2); // contou como 1º
  });
});
