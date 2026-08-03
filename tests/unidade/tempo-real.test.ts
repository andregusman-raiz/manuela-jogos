import { describe, expect, test } from "vitest";
import {
  DELTA_MAXIMO_MS,
  PASSOS_MAXIMOS_POR_QUADRO,
  PASSO_MS,
  criarLaco,
} from "@/lib/tempo-real";

/**
 * Contrato do laço de tempo real (SPEC-jogos-corrida §0.1, juiz B1):
 * fixed timestep com acumulador — o jogo NÃO acelera a 120 Hz e não faz
 * rajada de recuperação depois de aba lenta.
 */

function laboratorio() {
  let passos = 0;
  let quadros = 0;
  let pendente: ((agora: number) => void) | null = null;
  let cancelados = 0;
  const laco = criarLaco({
    aoPasso: () => {
      passos += 1;
    },
    aoQuadro: () => {
      quadros += 1;
    },
    agendar: (cb) => {
      pendente = cb;
      return 1;
    },
    cancelar: () => {
      pendente = null;
      cancelados += 1;
    },
  });
  const quadro = (agora: number) => {
    const cb = pendente;
    pendente = null;
    cb?.(agora);
  };
  return {
    laco,
    quadro,
    passos: () => passos,
    quadros: () => quadros,
    cancelados: () => cancelados,
    zerar: () => {
      passos = 0;
      quadros = 0;
    },
  };
}

describe("laço de tempo real", () => {
  test("a 120 Hz, 2 s de quadros executam ~120 passos (não 240)", () => {
    const lab = laboratorio();
    lab.laco.iniciar();
    let agora = 0;
    for (let i = 0; i < 240; i++) {
      lab.quadro(agora);
      agora += 1000 / 120;
    }
    // 2 s reais − 1 quadro de aquecimento ⇒ ~119-120 passos de 1/60
    expect(lab.passos()).toBeGreaterThanOrEqual(118);
    expect(lab.passos()).toBeLessThanOrEqual(121);
    expect(lab.quadros()).toBe(240); // pintura é 1× por quadro, sempre
  });

  test("a 60 Hz, 1 s executa ~60 passos", () => {
    const lab = laboratorio();
    lab.laco.iniciar();
    let agora = 0;
    for (let i = 0; i < 61; i++) {
      lab.quadro(agora);
      agora += PASSO_MS;
    }
    expect(lab.passos()).toBeGreaterThanOrEqual(58);
    expect(lab.passos()).toBeLessThanOrEqual(61);
  });

  test("quadro atrasado 2 s: teto de passos + excedente DESCARTADO (sem rajada)", () => {
    const lab = laboratorio();
    lab.laco.iniciar();
    lab.quadro(0);
    lab.zerar();
    lab.quadro(2000); // aba dormiu 2 s
    // delta truncado em DELTA_MAXIMO e no máximo PASSOS_MAXIMOS por quadro
    expect(lab.passos()).toBe(PASSOS_MAXIMOS_POR_QUADRO);
    expect(DELTA_MAXIMO_MS / PASSO_MS).toBeGreaterThan(PASSOS_MAXIMOS_POR_QUADRO);
    lab.zerar();
    lab.quadro(2000 + PASSO_MS); // quadro seguinte normal: SEM rajada acumulada
    expect(lab.passos()).toBeLessThanOrEqual(1);
  });

  test("parar() DENTRO de um passo mata o laço — fim de corrida não deixa rAF vivo (review B1)", () => {
    let pendente: ((agora: number) => void) | null = null;
    let passos = 0;
    const laco = criarLaco({
      aoPasso: () => {
        passos += 1;
        laco.parar(); // é o que aoFim faz no componente
      },
      aoQuadro: () => {},
      agendar: (cb) => {
        pendente = cb;
        return 1;
      },
      cancelar: () => {
        pendente = null;
      },
    });
    laco.iniciar();
    const aquecimento = pendente!;
    pendente = null;
    aquecimento(0);
    const segundo = pendente as ((agora: number) => void) | null;
    pendente = null;
    segundo?.(PASSO_MS);
    expect(passos).toBe(1);
    expect(pendente, "o quadro foi reagendado depois do parar()").toBeNull();
    expect(laco.rodando()).toBe(false);
  });

  test("parar cancela o quadro agendado e zera o relógio; iniciar 2× não duplica", () => {
    const lab = laboratorio();
    lab.laco.iniciar();
    lab.laco.iniciar();
    lab.quadro(0);
    lab.quadro(PASSO_MS);
    expect(lab.passos()).toBe(1); // um laço só
    lab.laco.parar();
    expect(lab.cancelados()).toBe(1);
    expect(lab.laco.rodando()).toBe(false);
    // reinício não herda acumulador: primeiro quadro é aquecimento
    lab.zerar();
    lab.laco.iniciar();
    lab.quadro(10000);
    expect(lab.passos()).toBe(0);
  });
});
