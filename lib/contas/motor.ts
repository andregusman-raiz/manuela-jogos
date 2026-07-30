import type { EstadoJogo, Evento, Nivel, Rodada } from "./tipos";

/**
 * Motor do Foguete das Contas — lógica pura, sem DOM.
 *
 * Mecânica inspirada no TuxMath (reimplementação própria): uma conta desce por
 * vez, a criança escolhe a resposta entre 4 bolhas. Nunca há "game over" — a
 * conta que chega embaixo só quica e volta mais devagar.
 */

export const ACERTOS_POR_FASE = 10;
export const NIVEL_MAXIMO: Nivel = 5;

/** mulberry32: determinístico sob seed — é o que torna o motor testável. */
export function criarRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function inteiro(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

type Conta = { texto: string; resposta: number };

function gerarConta(nivel: Nivel, rng: () => number): Conta {
  // Nível 5 é mistura UNIFORME dos níveis 1-4, com as mesmas faixas.
  const tipo = nivel === 5 ? (inteiro(rng, 1, 4) as Nivel) : nivel;

  if (tipo === 1) {
    // soma até 10
    const a = inteiro(rng, 0, 10);
    const b = inteiro(rng, 0, 10 - a);
    return { texto: `${a} + ${b}`, resposta: a + b };
  }
  if (tipo === 2) {
    // soma/subtração até 20 — subtração sempre a >= b (nunca negativo)
    if (rng() < 0.5) {
      const a = inteiro(rng, 0, 20);
      const b = inteiro(rng, 0, 20 - a);
      return { texto: `${a} + ${b}`, resposta: a + b };
    }
    const a = inteiro(rng, 1, 20);
    const b = inteiro(rng, 0, a);
    return { texto: `${a} − ${b}`, resposta: a - b };
  }
  // tabuadas: nível 3 = 2..5, nível 4 = 6..9
  const a = tipo === 3 ? inteiro(rng, 2, 5) : inteiro(rng, 6, 9);
  const b = inteiro(rng, 1, 10);
  return { texto: `${a} × ${b}`, resposta: a * b };
}

/** Troca dois dígitos de lugar (73 → 37); só vale para números de 2+ dígitos. */
function trocarDigitos(n: number): number | null {
  const s = String(n);
  if (s.length < 2 || s[0] === s[s.length - 1]) return null;
  return Number(s[s.length - 1] + s.slice(1, -1) + s[0]);
}

function embaralhar<T>(itens: T[], rng: () => number): T[] {
  const copia = [...itens];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

export function gerarRodada(nivel: Nivel, rng: () => number): Rodada {
  const { texto, resposta } = gerarConta(nivel, rng);

  // Distratores plausíveis: vizinhos, dezena errada, dígitos trocados.
  const candidatos = [
    resposta + 1,
    resposta - 1,
    resposta + 2,
    resposta - 2,
    resposta + 10,
    resposta - 10,
    trocarDigitos(resposta),
  ].filter((n): n is number => n !== null && n >= 0 && n !== resposta);

  const opcoes = new Set<number>([resposta]);
  for (const c of embaralhar(candidatos, rng)) {
    if (opcoes.size === 4) break;
    opcoes.add(c);
  }
  // fallback raro (respostas pequenas esgotam vizinhos >= 0)
  for (let extra = 3; opcoes.size < 4; extra++) opcoes.add(resposta + extra);

  return { conta: texto, resposta, opcoes: embaralhar([...opcoes], rng) };
}

export function criarJogo(nivel: Nivel, rng: () => number): EstadoJogo {
  return { nivel, rodada: gerarRodada(nivel, rng), fase: "caindo", acertos: 0, reapresentada: false };
}

/**
 * A máquina de estados da rodada. Evento fora de hora devolve o MESMO estado
 * (referência igual) — é isso que torna a corrida toque×chegada inofensiva:
 * dentro de um setState funcional, o segundo evento vira no-op.
 */
export function aplicar(estado: EstadoJogo, evento: Evento, rng: () => number): EstadoJogo {
  if (estado.fase === "caindo") {
    if (evento === "toque-certo") {
      const acertos = estado.acertos + 1;
      return acertos >= ACERTOS_POR_FASE
        ? { ...estado, acertos, fase: "fase-completa" }
        : { ...estado, acertos, fase: "resolvida" };
    }
    if (evento === "chegou-base") return { ...estado, fase: "quicou", reapresentada: true };
    return estado;
  }
  if (evento === "proxima") {
    if (estado.fase === "resolvida") {
      return { ...estado, rodada: gerarRodada(estado.nivel, rng), fase: "caindo", reapresentada: false };
    }
    if (estado.fase === "quicou") {
      // a MESMA conta volta ao topo, mais devagar
      return { ...estado, fase: "caindo" };
    }
  }
  return estado;
}

/** Segundos do topo à base: 12s no nível 1, −1s por nível (piso 8s); +35% na reapresentação. */
export function duracaoQueda(nivel: Nivel, reapresentada: boolean): number {
  const base = Math.max(8, 12 - (nivel - 1));
  return reapresentada ? base * 1.35 : base;
}

export function proximoNivel(nivel: Nivel): Nivel {
  return nivel >= NIVEL_MAXIMO ? NIVEL_MAXIMO : ((nivel + 1) as Nivel);
}
