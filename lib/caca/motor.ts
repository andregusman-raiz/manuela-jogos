import { criarRng } from "@/lib/contas/motor";

/**
 * Motor do Caça-Números — SPEC onda 3 §3.5 (herdeiro do gnumch, sem monstro).
 * Grade POR CONSTRUÇÃO: 16 números únicos, 4-8 corretos por rodada.
 */

export { criarRng };

export type NivelCaca = 1 | 2 | 3;
export const RODADAS_POR_FASE_CACA = 6;
export const CELULAS = 16;
export const NIVEL_MAXIMO_CACA: NivelCaca = 3;

/** N compostos com 5-8 fatores (36 tem NOVE — excluído no juízo). */
export const ENES = [12, 16, 18, 20, 24, 30] as const;

export type InstrucaoCaca =
  | { tipo: "pares"; rotulo: string }
  | { tipo: "impares"; rotulo: string }
  | { tipo: "multiplos"; alvo: number; rotulo: string }
  | { tipo: "fatores"; alvo: number; rotulo: string };

export type RodadaCaca = {
  instrucao: InstrucaoCaca;
  grade: number[];
  /** índices das células corretas. */
  certos: number[];
};

export function ehCerto(instrucao: InstrucaoCaca, numero: number): boolean {
  if (instrucao.tipo === "pares") return numero % 2 === 0;
  if (instrucao.tipo === "impares") return numero % 2 === 1;
  if (instrucao.tipo === "multiplos") return numero % instrucao.alvo === 0;
  return instrucao.alvo % numero === 0;
}

function embaralhar<T>(itens: T[], rng: () => number): T[] {
  const copia = [...itens];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

function faixa(inicio: number, fim: number): number[] {
  return Array.from({ length: fim - inicio + 1 }, (_, i) => inicio + i);
}

export function gerarRodada(nivel: NivelCaca, rng: () => number): RodadaCaca {
  let instrucao: InstrucaoCaca;
  let poolCertos: number[];
  let poolErrados: number[];

  if (nivel === 1) {
    const pares = rng() < 0.5;
    instrucao = pares
      ? { tipo: "pares", rotulo: "Toque em todos os PARES" }
      : { tipo: "impares", rotulo: "Toque em todos os ÍMPARES" };
    poolCertos = faixa(1, 30).filter((n) => ehCerto(instrucao, n));
    poolErrados = faixa(1, 30).filter((n) => !ehCerto(instrucao, n));
  } else if (nivel === 2) {
    const alvo = 2 + Math.floor(rng() * 8); // 2..9
    instrucao = { tipo: "multiplos", alvo, rotulo: `Toque nos MÚLTIPLOS de ${alvo}` };
    poolCertos = faixa(1, 60).filter((n) => ehCerto(instrucao, n));
    poolErrados = faixa(1, 60).filter((n) => !ehCerto(instrucao, n));
  } else {
    const alvo = ENES[Math.floor(rng() * ENES.length)];
    instrucao = { tipo: "fatores", alvo, rotulo: `Toque nos FATORES de ${alvo}` };
    // nível 3: a grade contém TODOS os fatores de N (5-8 por construção dos ENES)
    poolCertos = faixa(1, alvo).filter((n) => ehCerto(instrucao, n));
    poolErrados = faixa(2, 60).filter((n) => !ehCerto(instrucao, n));
  }

  const quantosCertos =
    instrucao.tipo === "fatores"
      ? poolCertos.length
      : 4 + Math.floor(rng() * 5); // 4..8
  const certosNumeros = embaralhar(poolCertos, rng).slice(0, quantosCertos);
  const erradosNumeros = embaralhar(poolErrados, rng).slice(0, CELULAS - certosNumeros.length);
  const grade = embaralhar([...certosNumeros, ...erradosNumeros], rng);

  return {
    instrucao,
    grade,
    certos: grade.map((n, i) => (ehCerto(instrucao, n) ? i : -1)).filter((i) => i >= 0),
  };
}

export function proximoNivelCaca(nivel: NivelCaca): NivelCaca {
  return nivel >= NIVEL_MAXIMO_CACA ? NIVEL_MAXIMO_CACA : ((nivel + 1) as NivelCaca);
}
