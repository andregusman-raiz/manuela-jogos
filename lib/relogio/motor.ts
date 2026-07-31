import { criarRng } from "@/lib/contas/motor";

/**
 * Motor do Relógio Mágico — SPEC onda 2 §3.2, lógica pura.
 * O detalhe que ensina: o ponteiro de HORA anda com os minutos
 * (h%12 × 30° + m × 0.5°).
 */

export { criarRng };

export type NivelRelogio = 1 | 2 | 3;

export type RodadaRelogio = {
  hora: number; // 1..12
  minuto: number;
  /** "7:30" — formato 1-12, sem 24h. */
  rotulo: string;
  /** 4 rótulos únicos embaralhados, contendo o certo, todos NA GRADE do nível. */
  opcoes: string[];
  angulos: { horaGraus: number; minutoGraus: number };
};

export const ACERTOS_POR_FASE_RELOGIO = 8;
export const NIVEL_MAXIMO_RELOGIO: NivelRelogio = 3;

export function gradeDoNivel(nivel: NivelRelogio): number[] {
  if (nivel === 1) return [0];
  if (nivel === 2) return [0, 15, 30, 45];
  return Array.from({ length: 12 }, (_, i) => i * 5);
}

export function rotular(hora: number, minuto: number): string {
  return `${hora}:${String(minuto).padStart(2, "0")}`;
}

export function angulosDe(hora: number, minuto: number): { horaGraus: number; minutoGraus: number } {
  return { horaGraus: (hora % 12) * 30 + minuto * 0.5, minutoGraus: minuto * 6 };
}

function horaValida(h: number): number {
  const m = ((h - 1) % 12) + 1;
  return m <= 0 ? m + 12 : m;
}

/** Quantiza um minuto qualquer para o valor mais próximo da grade do nível. */
function quantizar(minuto: number, grade: number[]): number {
  let melhor = grade[0];
  for (const g of grade) if (Math.abs(g - minuto) < Math.abs(melhor - minuto)) melhor = g;
  return melhor;
}

export function proximoNivelRelogio(nivel: NivelRelogio): NivelRelogio {
  return nivel >= NIVEL_MAXIMO_RELOGIO ? NIVEL_MAXIMO_RELOGIO : ((nivel + 1) as NivelRelogio);
}

function embaralhar<T>(itens: T[], rng: () => number): T[] {
  const copia = [...itens];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

/**
 * Distratores em ordem DETERMINÍSTICA (SPEC): h±1; leitura trocada quantizada
 * à grade; vizinho na grade (ou h±2 no nível 1); completa com h±2, h±3…
 * Sempre na grade do nível; sem colisão com a certa nem entre si.
 */
export function gerarRodada(nivel: NivelRelogio, rng: () => number): RodadaRelogio {
  const grade = gradeDoNivel(nivel);
  const hora = 1 + Math.floor(rng() * 12);
  const minuto = grade[Math.floor(rng() * grade.length)];
  const certo = rotular(hora, minuto);

  const candidatos: string[] = [];
  candidatos.push(rotular(horaValida(hora + 1), minuto));
  candidatos.push(rotular(horaValida(hora - 1), minuto));
  // leitura trocada: a criança lê o ponteiro dos minutos como hora e vice-versa
  const horaTrocada = horaValida(Math.round(minuto / 5) === 0 ? 12 : Math.round(minuto / 5));
  const minutoTrocado = quantizar(((hora % 12) * 5) % 60, grade);
  candidatos.push(rotular(horaTrocada, minutoTrocado));
  if (nivel === 1) {
    candidatos.push(rotular(horaValida(hora + 2), minuto));
  } else {
    const passo = nivel === 2 ? 15 : 5;
    candidatos.push(rotular(hora, (minuto + passo) % 60));
    candidatos.push(rotular(hora, (minuto - passo + 60) % 60));
  }
  for (let d = 2; candidatos.length < 9; d++) {
    candidatos.push(rotular(horaValida(hora + d), minuto));
    candidatos.push(rotular(horaValida(hora - d), minuto));
  }

  const opcoes = new Set<string>([certo]);
  for (const c of candidatos) {
    if (opcoes.size === 4) break;
    if (c !== certo) opcoes.add(c);
  }

  return {
    hora,
    minuto,
    rotulo: certo,
    opcoes: embaralhar([...opcoes], rng),
    angulos: angulosDe(hora, minuto),
  };
}
