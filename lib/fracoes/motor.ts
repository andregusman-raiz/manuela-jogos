import { criarRng } from "@/lib/contas/motor";

/**
 * Motor da Pizza das Frações — SPEC onda 3 §3.1, lógica pura.
 * Comparações SEMPRE por produto cruzado (inteiros; float nunca entra).
 */

export { criarRng };

export type NivelFracoes = 1 | 2 | 3;
export const ACERTOS_POR_FASE_FRACOES = 8;
export const NIVEL_MAXIMO_FRACOES: NivelFracoes = 3;

export type Fracao = { n: number; d: number };

export type RodadaLer = {
  tipo: "ler";
  alvo: Fracao;
  /** rótulos "N/D" únicos POR VALOR, contendo o certo. */
  opcoes: string[];
};

export type RodadaConstruir = {
  tipo: "construir";
  alvo: Fracao;
  /** fase da máquina: conferir() em "resolvida" é a MESMA referência. */
  fase: "montando" | "resolvida";
  pintadas: boolean[];
};

export type RodadaComparar = {
  tipo: "comparar";
  a: Fracao;
  b: Fracao;
};

export type RodadaFracoes = RodadaLer | RodadaConstruir | RodadaComparar;

export function rotular(f: Fracao): string {
  return `${f.n}/${f.d}`;
}

/** Ângulo inicial da fatia k de d (graus, 0° = topo, sentido horário). */
export function anguloDaFatia(k: number, d: number): { inicio: number; fim: number } {
  return { inicio: (k * 360) / d, fim: ((k + 1) * 360) / d };
}

/** Comparação por produto cruzado — inteiros, sem float. */
export function comparar(a: Fracao, b: Fracao): "a" | "igual" | "b" {
  const esquerda = a.n * b.d;
  const direita = b.n * a.d;
  if (esquerda === direita) return "igual";
  return esquerda > direita ? "a" : "b";
}

function mesmoValor(a: Fracao, b: Fracao): boolean {
  return comparar(a, b) === "igual";
}

function embaralhar<T>(itens: T[], rng: () => number): T[] {
  const copia = [...itens];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

function sortearAlvo(rng: () => number): Fracao {
  const d = 2 + Math.floor(rng() * 7); // 2..8
  const n = 1 + Math.floor(rng() * (d - 1)); // 1..d-1 (própria)
  return { n, d };
}

/**
 * Distratores (ordem da SPEC): complemento primeiro (o erro clássico de
 * contar o NÃO-pintado), vizinhos de numerador/denominador, até N/(D±2).
 * Podem ser impróprias ATÉ 1 inteiro (2/2); unicidade por VALOR.
 */
export function opcoesDe(alvo: Fracao, rng: () => number): string[] {
  const candidatos: Fracao[] = [
    { n: alvo.d - alvo.n, d: alvo.d },
    { n: Math.min(alvo.n + 1, alvo.d), d: alvo.d },
    { n: Math.max(alvo.n - 1, 1), d: alvo.d },
    { n: alvo.n, d: Math.min(alvo.d + 1, 8) },
    ...(alvo.n <= alvo.d - 1 && alvo.d - 1 >= 2 ? [{ n: alvo.n, d: alvo.d - 1 }] : []),
    { n: alvo.n, d: Math.min(alvo.d + 2, 8) },
    ...(alvo.d - 2 >= 2 && alvo.n <= alvo.d - 2 ? [{ n: alvo.n, d: alvo.d - 2 }] : []),
    { n: Math.min(alvo.n + 2, alvo.d), d: alvo.d },
  ];

  const escolhidas: Fracao[] = [alvo];
  for (const c of candidatos) {
    if (escolhidas.length === 4) break;
    if (c.n < 1 || c.n > c.d || c.d < 2 || c.d > 8) continue;
    if (escolhidas.some((e) => mesmoValor(e, c))) continue;
    escolhidas.push(c);
  }
  // fallback determinístico raro: varre o espaço inteiro
  for (let d = 2; d <= 8 && escolhidas.length < 4; d++) {
    for (let n = 1; n <= d && escolhidas.length < 4; n++) {
      const c = { n, d };
      if (!escolhidas.some((e) => mesmoValor(e, c))) escolhidas.push(c);
    }
  }
  return embaralhar(escolhidas.map(rotular), rng);
}

export function gerarRodada(nivel: NivelFracoes, rng: () => number): RodadaFracoes {
  if (nivel === 1) {
    const alvo = sortearAlvo(rng);
    return { tipo: "ler", alvo, opcoes: opcoesDe(alvo, rng) };
  }
  if (nivel === 2) {
    const alvo = sortearAlvo(rng);
    return { tipo: "construir", alvo, fase: "montando", pintadas: new Array(alvo.d).fill(false) };
  }
  // comparar: frações próprias, incluindo equivalências de propósito
  const a = sortearAlvo(rng);
  const b = sortearAlvo(rng);
  return { tipo: "comparar", a, b };
}

export function alternarFatia(rodada: RodadaConstruir, k: number): RodadaConstruir {
  if (rodada.fase !== "montando" || k < 0 || k >= rodada.pintadas.length) return rodada;
  const pintadas = [...rodada.pintadas];
  pintadas[k] = !pintadas[k];
  return { ...rodada, pintadas };
}

/** Idempotente: conferir uma rodada já resolvida devolve a MESMA referência. */
export function conferir(rodada: RodadaConstruir): { rodada: RodadaConstruir; certo: boolean } {
  if (rodada.fase === "resolvida") return { rodada, certo: true };
  const pintadas = rodada.pintadas.filter(Boolean).length;
  if (pintadas === rodada.alvo.n) {
    return { rodada: { ...rodada, fase: "resolvida" }, certo: true };
  }
  return { rodada, certo: false };
}

export function proximoNivelFracoes(nivel: NivelFracoes): NivelFracoes {
  return nivel >= NIVEL_MAXIMO_FRACOES ? NIVEL_MAXIMO_FRACOES : ((nivel + 1) as NivelFracoes);
}
