import { describe, expect, test } from "vitest";
import { criarSorte } from "@/lib/dado";
import {
  ACELERACAO,
  DT,
  FREIO,
  PISTAS,
  SPIN_TICKS,
  VMAX,
  VOLTAS,
  comprimentoTotal,
  criarIa,
  criarPartida,
  dFreio,
  distanciaTotal,
  entradaIa,
  tick,
  trechoEm,
} from "@/lib/autorama/motor";
import type { EstadoAutorama, IaAutorama, NivelAutorama, TrechoTrilho } from "@/lib/autorama/motor";
import { pontoNoTrilho } from "@/lib/autorama/trilho";

/**
 * Oráculos do motor do Autorama (SPEC-jogos-corrida §1). A equivalência
 * tick-a-tick vive AQUI (juiz B2): o E2E real só assere invariantes.
 */

function correndo(nivel: NivelAutorama): EstadoAutorama {
  return { ...criarPartida(nivel), situacao: "correndo" };
}

function comCarro(
  estado: EstadoAutorama,
  indice: 0 | 1,
  carro: Partial<EstadoAutorama["carros"][number]>,
): EstadoAutorama {
  const carros = estado.carros.map((c, i) => (i === indice ? { ...c, ...carro } : c)) as EstadoAutorama["carros"];
  return { ...estado, carros };
}

/** Corrida vs-IA até o fim (ou teto), coletando spins da IA. */
function simular(
  estado: EstadoAutorama,
  entradaJogador: (t: number) => boolean,
  ia: IaAutorama | null,
  tetoTicks: number,
): { estado: EstadoAutorama; spins: [number, number]; ticks: number } {
  const spins: [number, number] = [0, 0];
  let atual = estado;
  let valido = true;
  for (let t = 0; t < tetoTicks && atual.situacao === "correndo"; t++) {
    const pressionados = [
      entradaJogador(t),
      ia ? entradaIa(atual, ia) : entradaJogador(t),
    ];
    const novo = tick(atual, pressionados);
    novo.carros.forEach((c, i) => {
      if (c.rodando === SPIN_TICKS && atual.carros[i].rodando === 0) spins[i] += 1;
    });
    valido = valido && c0Valido(novo);
    atual = novo;
  }
  expect(valido, "invariante de velocidade/progresso violada").toBe(true);
  return { estado: atual, spins, ticks: atual.ticks };
}

function c0Valido(estado: EstadoAutorama): boolean {
  const total = comprimentoTotal(estado.pista);
  return estado.carros.every(
    (c) => c.velocidade >= 0 && c.velocidade <= VMAX && c.progresso >= 0 && c.progresso < total,
  );
}

describe("física básica", () => {
  test("segurar acelera ACELERACAO·dt por tick; soltar freia FREIO·dt; clamp [0, VMAX]", () => {
    let estado = correndo(1);
    for (let i = 0; i < 10; i++) estado = tick(estado, [true, false]);
    expect(estado.carros[0].velocidade).toBeCloseTo(10 * ACELERACAO * DT, 6);
    expect(estado.carros[1].velocidade).toBe(0); // soltar no zero fica no zero
    for (let i = 0; i < 300; i++) estado = tick(estado, [true, false]);
    expect(estado.carros[0].velocidade).toBe(VMAX); // clamp no teto
    for (let i = 0; i < 3; i++) estado = tick(estado, [false, false]);
    expect(estado.carros[0].velocidade).toBeCloseTo(VMAX - 3 * FREIO * DT, 6);
  });

  test("deslocamento por tick é v·dt", () => {
    let estado = comCarro(correndo(1), 0, { velocidade: 60 });
    const antes = estado.carros[0].progresso;
    estado = tick(estado, [false, false]); // solta: v vira 58.5 e anda 58.5·dt
    expect(estado.carros[0].progresso - antes).toBeCloseTo((60 - FREIO * DT) * DT, 6);
  });
});

describe("spin-out (ordem normativa §1.1)", () => {
  test("entrar na curva acima do limite roda NA ENTRADA (progresso = início do trecho)", () => {
    // carro a 1 u da curva (700) com v=60: cruza a fronteira no tick
    let estado = comCarro(correndo(1), 0, { progresso: 699, velocidade: 60 });
    estado = tick(estado, [true, false]);
    expect(estado.carros[0].rodando).toBe(SPIN_TICKS);
    expect(estado.carros[0].velocidade).toBe(0);
    expect(estado.carros[0].progresso).toBe(700); // parou na entrada, não dentro
  });

  test("no limite EXATO não roda (comparação estrita, sem EPS)", () => {
    // v chega a exatamente 55 dentro da curva: 54 + ACELERACAO·dt = 55
    let estado = comCarro(correndo(1), 0, { progresso: 800, velocidade: 54 });
    estado = tick(estado, [true, false]);
    expect(estado.carros[0].velocidade).toBe(55);
    expect(estado.carros[0].rodando).toBe(0);
  });

  test("caso do juiz B3: entra a 54 e acelera DENTRO da curva até 56 → roda no lugar", () => {
    let estado = comCarro(correndo(1), 0, { progresso: 800, velocidade: 55 });
    estado = tick(estado, [true, false]); // 55 + 1 = 56 > 55
    expect(estado.carros[0].rodando).toBe(SPIN_TICKS);
    expect(estado.carros[0].progresso).toBe(800); // rodou onde estava
  });

  test("carro rodando não acelera nem anda por SPIN_TICKS ticks, depois volta", () => {
    let estado = comCarro(correndo(1), 0, { progresso: 700, velocidade: 0, rodando: SPIN_TICKS });
    for (let i = 0; i < SPIN_TICKS; i++) {
      estado = tick(estado, [true, false]);
      expect(estado.carros[0].progresso).toBe(700);
    }
    expect(estado.carros[0].rodando).toBe(0);
    estado = tick(estado, [true, false]);
    expect(estado.carros[0].velocidade).toBeCloseTo(ACELERACAO * DT, 6);
  });

  test("cruzar VÁRIOS trechos num tick checa cada fronteira (pista sintética)", () => {
    // trechos minúsculos: com v=10 o carro anda 0.1667 u num tick e cruza 3
    const pista: TrechoTrilho[] = [
      { comprimento: 0.05, limite: null },
      { comprimento: 0.05, limite: 100 },
      { comprimento: 0.05, limite: null },
      { comprimento: 0.05, limite: 2 },
    ];
    const base = correndo(1);
    let estado: EstadoAutorama = comCarro({ ...base, pista }, 0, { velocidade: 10 });
    estado = tick(estado, [true, false]); // v=11 → anda 0.183 u e cruza 3 fronteiras
    expect(estado.carros[0].rodando).toBe(SPIN_TICKS);
    expect(estado.carros[0].progresso).toBeCloseTo(0.15, 9); // entrada do trecho de limite 2
  });
});

describe("voltas, chegada e empate", () => {
  test("cruzar a linha soma volta; a 3ª encerra com vencedor", () => {
    const pista = PISTAS[1];
    const total = comprimentoTotal(pista);
    let estado = comCarro(correndo(1), 0, { progresso: total - 0.5, velocidade: 50, voltas: VOLTAS - 1 });
    estado = tick(estado, [false, false]); // anda ~0.8 u e cruza a linha
    expect(estado.carros[0].voltas).toBe(VOLTAS);
    expect(estado.situacao).toBe("fim");
    expect(estado.vencedor).toBe(0);
  });

  test("os DOIS cruzam a 3ª volta no mesmo tick → empate (vencedor -1)", () => {
    const total = comprimentoTotal(PISTAS[1]);
    let estado = correndo(1);
    estado = comCarro(estado, 0, { progresso: total - 0.5, velocidade: 50, voltas: VOLTAS - 1 });
    estado = comCarro(estado, 1, { progresso: total - 0.5, velocidade: 50, voltas: VOLTAS - 1 });
    estado = tick(estado, [false, false]);
    expect(estado.situacao).toBe("fim");
    expect(estado.vencedor).toBe(-1);
  });

  test("fora de 'correndo' o tick é inerte", () => {
    const estado = criarPartida(1); // contagem
    expect(tick(estado, [true, true])).toBe(estado);
  });
});

describe("IA da mascote (§1.2 — cinemática)", () => {
  test("dFreio é (v²−lim²)/(2·FREIO), nunca negativa", () => {
    expect(dFreio(120, 55)).toBeCloseTo((120 * 120 - 55 * 55) / (2 * FREIO), 6);
    expect(dFreio(40, 55)).toBe(0);
  });

  test("semente 81 (a do E2E): err -48 nas DUAS curvas — a IA roda nas duas, mesmo com rubber", () => {
    const ia = criarIa(PISTAS[1], 1, criarSorte(81));
    expect(ia.errPorTrecho[1]).toBe(-48);
    expect(ia.errPorTrecho[3]).toBe(-48);
    // e roda de fato já na volta 1 (oráculo compartilhado com o autorama.spec)
    const { spins } = simular(correndo(1), () => false, ia, 3600);
    expect(spins[1]).toBeGreaterThanOrEqual(2);
  });

  test("o piloto do E2E, com latência realista de 200 ms, VENCE a IA da semente 81", () => {
    // espelho do decidir() do autorama.spec: dead-reckoning sobre leituras
    // de HUD públicadas a 10 Hz e decisões aplicadas a cada ~90 ms
    const ia = criarIa(PISTAS[1], 1, criarSorte(81));
    let estado = correndo(1);
    let leitura = { p0: 0, v0: 0, ticksNaLeitura: 0 };
    let segurando = false;
    for (let t = 0; t < 12000 && estado.situacao === "correndo"; t++) {
      if (t % 6 === 0) {
        // HUD publica a cada 6 ticks; o piloto lê o valor com atraso de 1 ciclo
        leitura = { p0: estado.carros[0].progresso, v0: estado.carros[0].velocidade, ticksNaLeitura: t };
      }
      if (t % 5 === 2) {
        const idade = (t - leitura.ticksNaLeitura) / 60 + 0.1;
        const vEst: number = segurando
          ? Math.min(VMAX, leitura.v0 + ACELERACAO * idade)
          : Math.max(0, leitura.v0 - FREIO * idade * 0.7);
        const pEst = (leitura.p0 + vEst * idade) % 2000;
        const emCurva = (pEst >= 700 && pEst < 1000) || (pEst >= 1700 && pEst < 2000);
        if (emCurva) {
          segurando = vEst < 44;
        } else {
          const entrada = pEst < 700 ? 700 : pEst < 1700 ? 1700 : 2700;
          const dist = entrada - pEst;
          const proxima = Math.min(VMAX, vEst + 2);
          segurando = !(proxima > 55 && dist <= (proxima * proxima - 55 * 55) / (2 * FREIO) + 30);
        }
      }
      estado = tick(estado, [segurando, entradaIa(estado, ia)]);
    }
    expect(estado.situacao).toBe("fim");
    expect(estado.vencedor, "o piloto do E2E deveria vencer com a semente 81").toBe(0);
  });

  test("com err=0 a IA NUNCA roda e completa as 3 voltas", () => {
    for (const nivel of [1, 2] as const) {
      const ia: IaAutorama = {
        errPorTrecho: PISTAS[nivel].map(() => 0),
        margem: nivel === 1 ? 30 : 45,
        teto: nivel === 1 ? 0.75 * VMAX : 0.92 * VMAX,
      };
      const { estado, spins } = simular(correndo(nivel), () => false, ia, 20000);
      expect(spins[1], `nível ${nivel} rodou`).toBe(0);
      expect(estado.situacao, `nível ${nivel} não terminou`).toBe("fim");
    }
  });

  test("com atraso forçado (err muito negativo) a IA SEMPRE roda, na entrada da curva", () => {
    const ia: IaAutorama = { errPorTrecho: PISTAS[1].map(() => -10000), margem: 30, teto: VMAX };
    let estado = correndo(1);
    let rodouEm = -1;
    for (let t = 0; t < 3600 && rodouEm < 0; t++) {
      estado = tick(estado, [false, entradaIa(estado, ia)]);
      if (estado.carros[1].rodando === SPIN_TICKS) rodouEm = estado.carros[1].progresso;
    }
    expect(rodouEm).toBe(700); // entrada da primeira curva
  });

  test("matriz de sementes 1..50 dentro das faixas da SPEC (gêmeos, sem rubber)", () => {
    // os dois carros com a MESMA entrada da IA => diferença de distância 0,
    // rubber nunca liga — o oráculo mede a IA crua (margem base)
    const contagem = { 1: 0, 2: 0 };
    for (const nivel of [1, 2] as const) {
      for (let semente = 1; semente <= 50; semente++) {
        const ia = criarIa(PISTAS[nivel], nivel, criarSorte(semente));
        let estado = correndo(nivel);
        let rodou = false;
        for (let t = 0; t < 9000 && estado.situacao === "correndo"; t++) {
          const segura = entradaIa(estado, ia);
          const novo = tick(estado, [segura, segura]);
          if (novo.carros[1].rodando === SPIN_TICKS && estado.carros[1].rodando === 0) rodou = true;
          estado = novo;
        }
        if (rodou) contagem[nivel] += 1;
      }
    }
    // nível 1: 30%-90% das 50; nível 2: 0%-20% (valores reais: 34 e 9)
    expect(contagem[1]).toBeGreaterThanOrEqual(15);
    expect(contagem[1]).toBeLessThanOrEqual(45);
    expect(contagem[2]).toBeGreaterThanOrEqual(0);
    expect(contagem[2]).toBeLessThanOrEqual(10);
  });

  test("rubber-band liga por distanciaTotal > meia pista e limita a IA a 0.8·VMAX", () => {
    const pista = PISTAS[1];
    const total = comprimentoTotal(pista);
    const ia: IaAutorama = { errPorTrecho: pista.map(() => 0), margem: 30, teto: VMAX };
    // IA liderando por mais de meia pista, em reta longe da curva, v acima de 0.8·VMAX
    let estado = correndo(1);
    estado = comCarro(estado, 1, { progresso: 100, velocidade: 97, voltas: 1 });
    estado = comCarro(estado, 0, { progresso: 50, velocidade: 0, voltas: 0 });
    expect(distanciaTotal(estado.carros[1], total) - distanciaTotal(estado.carros[0], total)).toBeGreaterThan(total / 2);
    expect(entradaIa(estado, ia)).toBe(false); // esperaria a criança
    // mesma posição SEM liderança: acelera normal
    estado = comCarro(estado, 1, { voltas: 0, progresso: 100, velocidade: 97 });
    expect(entradaIa(estado, ia)).toBe(true);
  });

  test("meia pista é comprimento/2 por distância TOTAL, não diferença de progresso pós-wrap", () => {
    const pista = PISTAS[1];
    // IA logo depois da linha (progresso pequeno) mas 1 volta À FRENTE:
    // diferença de progresso bruta seria negativa; a total é > meia pista
    let estado = correndo(1);
    estado = comCarro(estado, 1, { progresso: 10, velocidade: 97, voltas: 2 });
    estado = comCarro(estado, 0, { progresso: 600, velocidade: 0, voltas: 0 });
    expect(entradaIa(estado, { errPorTrecho: pista.map(() => 0), margem: 30, teto: VMAX })).toBe(false);
  });
});

describe("fuzz vs-Manu (200 corridas seeded)", () => {
  test("toda corrida termina em ≤ 7200 ticks com invariantes de velocidade e progresso", () => {
    for (let semente = 1; semente <= 100; semente++) {
      for (const nivel of [1, 2] as const) {
        const sorte = criarSorte(semente * 1000 + nivel);
        const ia = criarIa(PISTAS[nivel], nivel, criarSorte(semente));
        // entrada da criança re-sorteada a cada meio segundo (padrão errático real)
        let atual = false;
        const entrada = (t: number) => {
          if (t % 30 === 0) atual = sorte() < 0.6;
          return atual;
        };
        const { estado } = simular(correndo(nivel), entrada, ia, 7200);
        expect(estado.situacao, `semente ${semente} nível ${nivel} não terminou`).toBe("fim");
      }
    }
  });
});

describe("trilho visual (progresso→ponto é do motor, não do DOM)", () => {
  test("largada no (0,0) apontando para leste; meio da reta 1 é linear", () => {
    const inicio = pontoNoTrilho(1, 0, 0);
    expect(inicio.x).toBeCloseTo(0, 1);
    expect(inicio.y).toBeCloseTo(0, 1);
    expect(inicio.angulo).toBeCloseTo(0, 3);
    const meio = pontoNoTrilho(1, 350, 0);
    expect(meio.x).toBeCloseTo(35, 1); // 350 u = metade da reta de 70 vu
    expect(meio.y).toBeCloseTo(0, 1);
  });

  test("o trilho FECHA: fim da última peça encosta na largada (2 níveis)", () => {
    for (const nivel of [1, 2] as const) {
      const total = comprimentoTotal(PISTAS[nivel]);
      const fim = pontoNoTrilho(nivel, total - 0.01, 0);
      expect(Math.hypot(fim.x, fim.y), `nível ${nivel} não fecha`).toBeLessThan(1.5);
    }
  });

  test("fronteiras entre trechos são contínuas (sem salto de posição)", () => {
    for (const nivel of [1, 2] as const) {
      const pista = PISTAS[nivel];
      let fronteira = 0;
      for (let i = 0; i < pista.length - 1; i++) {
        fronteira += pista[i].comprimento;
        const antes = pontoNoTrilho(nivel, fronteira - 0.01, 0);
        const depois = pontoNoTrilho(nivel, fronteira + 0.01, 0);
        expect(Math.hypot(antes.x - depois.x, antes.y - depois.y)).toBeLessThan(1);
      }
    }
  });

  test("deslocamento perpendicular separa os dois slots", () => {
    const esquerda = pontoNoTrilho(1, 350, -2.5);
    const direita = pontoNoTrilho(1, 350, 2.5);
    expect(Math.hypot(esquerda.x - direita.x, esquerda.y - direita.y)).toBeCloseTo(5, 1);
  });
});

describe("helpers", () => {
  test("trechoEm cobre entrada inclusa e fim exclusivo", () => {
    const pista = PISTAS[1];
    expect(trechoEm(pista, 0)).toBe(0);
    expect(trechoEm(pista, 699.99)).toBe(0);
    expect(trechoEm(pista, 700)).toBe(1);
    expect(trechoEm(pista, 1999.99)).toBe(3);
  });
});
