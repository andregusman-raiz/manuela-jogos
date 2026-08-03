/**
 * Motor do Autorama (SPEC-jogos-corrida §1) — slot car de 1 botão.
 *
 * Física em 1 dimensão num trilho fechado: segurar acelera, soltar freia,
 * passar do limite na curva = roda no lugar (nunca sai do trilho, nunca
 * perde volta — anti-frustração 5 anos). Tick PURO com dt fixo 1/60; quem
 * fecha o loop é lib/tempo-real. Sem rng aqui dentro: as entradas (criança
 * e IA) vêm de fora a cada tick.
 */

export const DT = 1 / 60;
export const VMAX = 120; // u/s
export const ACELERACAO = 60; // u/s²
export const FREIO = 90; // u/s²
export const SPIN_TICKS = 60; // 1 s girando no lugar
export const VOLTAS = 3;

export type NivelAutorama = 1 | 2;

export interface TrechoTrilho {
  comprimento: number;
  /** Velocidade máxima segura do trecho; null = reta livre. */
  limite: number | null;
}

export interface CarroAutorama {
  /** 0..comprimentoTotal, dá a volta (wrap). */
  progresso: number;
  velocidade: number;
  /** Ticks restantes de spin-out (0 = correndo). */
  rodando: number;
  voltas: number;
}

export type SituacaoAutorama = "contagem" | "correndo" | "pausa" | "fim";

export interface EstadoAutorama {
  pista: readonly TrechoTrilho[];
  carros: [CarroAutorama, CarroAutorama];
  situacao: SituacaoAutorama;
  /** Índice do carro vencedor; -1 = empate no mesmo tick. */
  vencedor: number | null;
  ticks: number;
}

/** Pistas FIXAS da SPEC (oráculo testável — nunca geradas). */
export const PISTAS: Record<NivelAutorama, readonly TrechoTrilho[]> = {
  1: [
    { comprimento: 700, limite: null },
    { comprimento: 300, limite: 55 },
    { comprimento: 700, limite: null },
    { comprimento: 300, limite: 55 },
  ],
  2: [
    { comprimento: 500, limite: null },
    { comprimento: 250, limite: 55 },
    { comprimento: 150, limite: null },
    { comprimento: 200, limite: 40 },
    { comprimento: 200, limite: 40 },
    { comprimento: 500, limite: null },
    { comprimento: 300, limite: 55 },
    { comprimento: 300, limite: null },
  ],
};

export function comprimentoTotal(pista: readonly TrechoTrilho[]): number {
  return pista.reduce((soma, t) => soma + t.comprimento, 0);
}

export function inicioDoTrecho(pista: readonly TrechoTrilho[], indice: number): number {
  let inicio = 0;
  for (let i = 0; i < indice; i++) inicio += pista[i].comprimento;
  return inicio;
}

/** Índice do trecho que contém `progresso` (entrada do trecho inclusa). */
export function trechoEm(pista: readonly TrechoTrilho[], progresso: number): number {
  let fim = 0;
  for (let i = 0; i < pista.length; i++) {
    fim += pista[i].comprimento;
    if (progresso < fim) return i;
  }
  return pista.length - 1;
}

export function distanciaTotal(carro: CarroAutorama, comprimento: number): number {
  return carro.voltas * comprimento + carro.progresso;
}

function carroNovo(): CarroAutorama {
  return { progresso: 0, velocidade: 0, rodando: 0, voltas: 0 };
}

export function criarPartida(nivel: NivelAutorama): EstadoAutorama {
  return {
    pista: PISTAS[nivel],
    carros: [carroNovo(), carroNovo()],
    situacao: "contagem",
    vencedor: null,
    ticks: 0,
  };
}

/**
 * Move um carro pelo deslocamento do tick, checando CADA fronteira de trecho
 * cruzada (ordem normativa §1.1 passos 3-5): entrar num trecho limitado acima
 * do limite = spin NA ENTRADA dele. Cruzar a linha soma volta; a 3ª encerra.
 */
function avancar(pista: readonly TrechoTrilho[], carro: CarroAutorama): void {
  let restante = carro.velocidade * DT;
  while (restante > 1e-9) {
    const i = trechoEm(pista, carro.progresso);
    const fimTrecho = inicioDoTrecho(pista, i) + pista[i].comprimento;
    const ate = fimTrecho - carro.progresso;
    if (restante < ate) {
      carro.progresso += restante;
      return;
    }
    restante -= ate;
    const proximo = (i + 1) % pista.length;
    if (proximo === 0) {
      carro.progresso = 0;
      carro.voltas += 1;
      if (carro.voltas >= VOLTAS) return; // cruzou a chegada: acabou
    } else {
      carro.progresso = fimTrecho;
    }
    const limite = pista[proximo].limite;
    if (limite !== null && carro.velocidade > limite) {
      carro.velocidade = 0;
      carro.rodando = SPIN_TICKS;
      return;
    }
  }
}

/** Um passo de simulação (dt fixo). Fora de "correndo" devolve o estado como está. */
export function tick(estado: EstadoAutorama, pressionados: readonly boolean[]): EstadoAutorama {
  if (estado.situacao !== "correndo") return estado;
  const pista = estado.pista;
  const carros = estado.carros.map((c) => ({ ...c })) as [CarroAutorama, CarroAutorama];
  const chegaram: number[] = [];

  carros.forEach((carro, indice) => {
    if (carro.rodando > 0) {
      carro.rodando -= 1; // girando: não acelera nem anda
      return;
    }
    // 1. velocidade pela entrada
    const taxa = pressionados[indice] ? ACELERACAO : -FREIO;
    carro.velocidade = Math.min(VMAX, Math.max(0, carro.velocidade + taxa * DT));
    // 2. trecho ATUAL: acelerar DENTRO da curva acima do limite também roda
    const limiteAtual = pista[trechoEm(pista, carro.progresso)].limite;
    if (limiteAtual !== null && carro.velocidade > limiteAtual) {
      carro.velocidade = 0;
      carro.rodando = SPIN_TICKS;
      return;
    }
    // 3-5. deslocamento com checagem de cada fronteira cruzada
    avancar(pista, carro);
    if (carro.voltas >= VOLTAS) chegaram.push(indice);
  });

  let situacao: SituacaoAutorama = estado.situacao;
  let vencedor = estado.vencedor;
  if (chegaram.length > 0) {
    situacao = "fim";
    vencedor = chegaram.length === 2 ? -1 : chegaram[0]; // mesmo tick = empate
  }
  return { ...estado, carros, situacao, vencedor, ticks: estado.ticks + 1 };
}

// ---------------------------------------------------------------------------
// IA da mascote (§1.2) — cinemática, não chute: solta o botão a
// dFreio(v, limite) + MARGEM + err unidades da entrada da próxima curva.

/** Distância mínima de frenagem de v até o limite (v²−lim²)/(2·FREIO). */
export function dFreio(velocidade: number, limite: number): number {
  return Math.max(0, (velocidade * velocidade - limite * limite) / (2 * FREIO));
}

export interface IaAutorama {
  /** err sorteado por trecho LIMITADO na largada; 0 nos demais. */
  errPorTrecho: number[];
  margem: number;
  /** Teto de velocidade da IA (adendo §1.2): a VMAX pleno ela era IMBATÍVEL
   *  mesmo rodando 2× por volta — provado por simulação; criança nunca
   *  desbloquearia o nível 2. Nível 1 = 0.75·VMAX, nível 2 = 0.92·VMAX. */
  teto: number;
}

/**
 * Sorteia o erro da IA por trecho limitado. Burn-in de 3 sorteios: os
 * primeiros outputs do Park-Miller com sementes pequenas são quase-zero
 * (x=16807·s/2³¹) — sem descartar, err seria SEMPRE o piso da faixa e a IA
 * rodaria em 100% das corridas, fora do oráculo §1.2.
 */
export function criarIa(
  pista: readonly TrechoTrilho[],
  nivel: NivelAutorama,
  sorte: () => number,
): IaAutorama {
  for (let i = 0; i < 3; i++) sorte();
  const [piso, topo] = nivel === 1 ? [-60, 20] : [-48, 12];
  const errPorTrecho = pista.map((t) =>
    t.limite === null ? 0 : piso + Math.floor(sorte() * (topo - piso + 1)),
  );
  return {
    errPorTrecho,
    margem: nivel === 1 ? 30 : 46,
    teto: nivel === 1 ? 0.75 * VMAX : 0.92 * VMAX,
  };
}

/**
 * Entrada da IA (carro 1) para o próximo tick. Rubber-band só a favor da
 * criança: liderando por mais de meia pista, a IA freia mais cedo (margem
 * ×1.3) e anda mais devagar (0.8·VMAX) até ser alcançada.
 */
export function entradaIa(estado: EstadoAutorama, ia: IaAutorama): boolean {
  const carro = estado.carros[1];
  if (carro.rodando > 0) return false;
  const pista = estado.pista;
  const comprimento = comprimentoTotal(pista);
  const lidera =
    distanciaTotal(estado.carros[1], comprimento) - distanciaTotal(estado.carros[0], comprimento) >
    comprimento / 2;
  const margem = lidera ? ia.margem * 1.3 : ia.margem;
  const vmaxIa = lidera ? ia.teto * 0.8 : ia.teto;
  const proximaVelocidade = carro.velocidade + ACELERACAO * DT;

  const atual = trechoEm(pista, carro.progresso);
  const limiteAtual = pista[atual].limite;
  if (limiteAtual !== null) return proximaVelocidade < limiteAtual; // dentro da curva: conservador

  // distância até a ENTRADA do próximo trecho limitado (com wrap)
  let distancia = inicioDoTrecho(pista, atual) + pista[atual].comprimento - carro.progresso;
  let alvo = (atual + 1) % pista.length;
  while (pista[alvo].limite === null) {
    distancia += pista[alvo].comprimento;
    alvo = (alvo + 1) % pista.length;
  }
  // só freia se fosse ENTRAR acima do limite — frear com v já segura
  // estacionaria o carro antes da curva para sempre (deadlock)
  const limiteAlvo = pista[alvo].limite!;
  if (
    proximaVelocidade > limiteAlvo &&
    distancia <= dFreio(proximaVelocidade, limiteAlvo) + margem + ia.errPorTrecho[alvo]
  ) {
    return false;
  }
  return proximaVelocidade <= vmaxIa;
}
