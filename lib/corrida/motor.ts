/**
 * Motor da Corrida (SPEC-jogos-corrida §2) — pseudo-3D em segmentos.
 *
 * Referência de TÉCNICA: jakesgordon/javascript-racer (MIT, lido e não
 * copiado — arte/nomes/estrutura próprios). Física em UMA dimensão lateral:
 * aceleração é automática (criança não gerencia gás), curva empurra para
 * fora, as zonas de toque compensam, grama desacelera mas NUNCA para.
 * Elevação é PURAMENTE visual. Tick puro dt=1/60; o loop é lib/tempo-real.
 */

export const DT = 1 / 60;
export const SEGMENTO = 200; // u de pista por segmento
export const VMAX = 1200; // u/s
export const ACELERACAO = 300; // u/s² (automática)
export const DESACEL_GRAMA = 800; // u/s² até VGRAMA
export const VGRAMA = 350; // u/s — na grama segue andando, nunca para
export const FORCA_CURVA = 1.6; // lateral/s a fundo em curva 1.0
export const FORCA_DIRECAO = 1.2; // lateral/s da criança
export const LATERAL_MAXIMO = 2.5; // clamp (juiz-melhoria)
export const COMPRIMENTO_CARRO = 80; // u — colisão longitudinal
export const LATERAL_CARRO = 0.3; // colisão lateral
export const TICKS_3_ESTRELAS = 70 * 60; // ≤ 70 s
export const TICKS_2_ESTRELAS = 95 * 60; // ≤ 95 s
export const TETO_SEM_TOQUE_TICKS = 10_500; // §2.1: direcao=0 SEMPRE termina antes

export type NivelCorrida = 1 | 2;

export interface SegmentoPista {
  curva: number; // -1..1 (negativo = esquerda)
  elevacao: number; // SÓ visual — não afeta a física
}

export interface OponenteCorrida {
  posicao: number;
  lateral: number;
  /** Velocidade-base sorteada na largada; rubber-band aplica fator por tick. */
  base: number;
  velocidade: number;
}

export type SituacaoCorrida = "contagem" | "correndo" | "pausa" | "fim";

export interface EstadoCorrida {
  segmentos: readonly SegmentoPista[];
  posicao: number;
  lateral: number;
  velocidade: number;
  tempoTicks: number;
  oponentes: OponenteCorrida[];
  situacao: SituacaoCorrida;
  /** Preenchido no fim: 0-3. */
  estrelas: number;
}

export function comprimentoDaPista(segmentos: readonly SegmentoPista[]): number {
  return segmentos.length * SEGMENTO;
}

export function segmentoEm(segmentos: readonly SegmentoPista[], posicao: number): number {
  const indice = Math.floor(posicao / SEGMENTO);
  return Math.min(Math.max(indice, 0), segmentos.length - 1);
}

export function naGrama(lateral: number): boolean {
  return Math.abs(lateral) > 1;
}

/** Oponentes determinísticos por semente (burn-in de 3 — viés do LCG). */
export function criarOponentes(sorte: () => number): OponenteCorrida[] {
  for (let i = 0; i < 3; i++) sorte();
  return [1500, 3000, 4500].map((posicao) => {
    const base = (0.8 + sorte() * 0.12) * VMAX; // ∈ [0.80, 0.92]·VMAX
    const lateral = -0.6 + sorte() * 1.2; // faixa fixa da largada
    return { posicao, lateral, base, velocidade: base };
  });
}

export function criarCorrida(
  segmentos: readonly SegmentoPista[],
  oponentes: OponenteCorrida[],
): EstadoCorrida {
  return {
    segmentos,
    posicao: 0,
    lateral: 0,
    velocidade: 0,
    tempoTicks: 0,
    oponentes,
    situacao: "contagem",
    estrelas: 0,
  };
}

/** Quantos oponentes ainda estão à FRENTE do jogador. */
export function oponentesNaFrente(estado: EstadoCorrida): number {
  return estado.oponentes.filter((o) => o.posicao > estado.posicao).length;
}

/** Estrelas do nível 1: terminar = 1; ≤95 s = 2; ≤70 s = 3. */
export function estrelasNivel1(tempoTicks: number): number {
  if (tempoTicks <= TICKS_3_ESTRELAS) return 3;
  if (tempoTicks <= TICKS_2_ESTRELAS) return 2;
  return 1;
}

/** Nível 2: terminar = 1; em 1º = 2; em 1º e ≤70 s = 3 (clamp 3, sem 4ª). */
export function estrelasNivel2(tempoTicks: number, emPrimeiro: boolean): number {
  if (!emPrimeiro) return 1;
  return tempoTicks <= TICKS_3_ESTRELAS ? 3 : 2;
}

/** Um passo de simulação. `direcao`: -1 esquerda, 1 direita, 0 solto. */
export function tick(estado: EstadoCorrida, direcao: -1 | 0 | 1): EstadoCorrida {
  if (estado.situacao !== "correndo") return estado;
  const comprimento = comprimentoDaPista(estado.segmentos);

  // 1. velocidade: automática até VMAX; grama derruba até VGRAMA
  let velocidade = estado.velocidade;
  if (naGrama(estado.lateral)) {
    velocidade =
      velocidade > VGRAMA
        ? Math.max(VGRAMA, velocidade - DESACEL_GRAMA * DT)
        : Math.min(VGRAMA, velocidade + ACELERACAO * DT);
  } else {
    velocidade = Math.min(VMAX, velocidade + ACELERACAO * DT);
  }

  // 2. lateral: curva empurra proporcional à velocidade; criança compensa
  //    (convenção: lateral positivo = direita; direcao -1 = zona esquerda)
  const curva = estado.segmentos[segmentoEm(estado.segmentos, estado.posicao)].curva;
  let lateral =
    estado.lateral + curva * (velocidade / VMAX) * FORCA_CURVA * DT + direcao * FORCA_DIRECAO * DT;
  lateral = Math.min(LATERAL_MAXIMO, Math.max(-LATERAL_MAXIMO, lateral));

  // 3. oponentes primeiro calculam o fator de rubber-band do TICK, depois
  //    andam (jogador atualiza antes, oponentes em ordem de índice — §2.1)
  const posicao = estado.posicao + velocidade * DT;
  const ultimo = Math.min(...estado.oponentes.map((o) => o.posicao), Infinity);
  const primeiro = Math.max(...estado.oponentes.map((o) => o.posicao), -Infinity);
  const fator =
    estado.oponentes.length === 0
      ? 1
      : posicao < ultimo
        ? 0.95 // jogador atrás de todos: esperam
        : posicao > primeiro + 3000
          ? 1.05 // jogador disparou: reagem
          : 1;
  const oponentes = estado.oponentes.map((o) => {
    const velocidadeOponente = o.base * fator;
    return { ...o, velocidade: velocidadeOponente, posicao: o.posicao + velocidadeOponente * DT };
  });

  // 4. colisão fantasma-suave: oponente À FRENTE encostado limita a
  //    velocidade do jogador neste tick (0 < Δpos ≤ carro; |Δlat| < 0.3)
  let velocidadeFinal = velocidade;
  for (const o of oponentes) {
    const distancia = o.posicao - posicao;
    if (
      distancia > 0 &&
      distancia <= COMPRIMENTO_CARRO &&
      Math.abs(o.lateral - lateral) < LATERAL_CARRO
    ) {
      velocidadeFinal = Math.min(velocidadeFinal, o.velocidade);
    }
  }

  const tempoTicks = estado.tempoTicks + 1;
  const novo: EstadoCorrida = {
    ...estado,
    posicao,
    lateral,
    velocidade: velocidadeFinal,
    tempoTicks,
    oponentes,
  };

  // 5. chegada
  if (posicao >= comprimento) {
    novo.situacao = "fim";
    novo.estrelas =
      estado.oponentes.length === 0
        ? estrelasNivel1(tempoTicks)
        : estrelasNivel2(tempoTicks, oponentesNaFrente(novo) === 0);
  }
  return novo;
}

/** Controlador de teste COMPARTILHADO unit↔E2E (§2.2): bang-bang no lateral. */
export function direcaoTeste(lateral: number): -1 | 0 | 1 {
  if (Math.abs(lateral) <= 0.25) return 0;
  return lateral > 0 ? -1 : 1;
}
