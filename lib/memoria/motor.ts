import { criarRng } from "@/lib/contas/motor";
import type { Carta, EstadoTabuleiro, NivelMemoria } from "./tipos";

/**
 * Motor do Jogo da Memória — lógica pura, sem DOM e sem timer: os 900ms são um
 * evento `fechar` injetado pelo componente, nunca um setTimeout aqui dentro.
 */

export { criarRng };

/** Repertório concreto de 6-10 anos: animais, frutas e objetos do dia a dia. */
export const EMOJIS = [
  "🐱",
  "🐶",
  "🐰",
  "🦊",
  "🐻",
  "🐼",
  "🐸",
  "🦁",
  "🐵",
  "🐷",
  "🐥",
  "🦋",
  "🍎",
  "🍌",
  "🍓",
  "🍉",
  "🍇",
  "🥕",
  "⚽",
  "🎈",
  "🎁",
  "🌟",
  "🌈",
  "🚗",
] as const;

export const PARES_POR_NIVEL: Record<NivelMemoria, number> = { 1: 6, 2: 8, 3: 6 };
export const NIVEL_MAXIMO_MEMORIA: NivelMemoria = 3;

function embaralhar<T>(itens: T[], rng: () => number): T[] {
  const copia = [...itens];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

/** Nível 3: pares conta↔resultado com RESULTADOS ÚNICOS na fase (SPEC §4.2). */
function paresDeContas(quantos: number, rng: () => number): Array<[string, string]> {
  const pares: Array<[string, string]> = [];
  const resultados = new Set<number>();
  const candidatos = embaralhar(
    Array.from({ length: 4 * 10 }, (_, i) => {
      const a = 2 + Math.floor(i / 10);
      const b = 1 + (i % 10);
      return [a, b] as const;
    }),
    rng,
  );
  for (const [a, b] of candidatos) {
    if (pares.length === quantos) break;
    if (resultados.has(a * b)) continue;
    resultados.add(a * b);
    pares.push([`${a} × ${b}`, String(a * b)]);
  }
  return pares;
}

export function criarTabuleiro(nivel: NivelMemoria, rng: () => number): EstadoTabuleiro {
  const quantos = PARES_POR_NIVEL[nivel];
  const faces: Array<Pick<Carta, "parId" | "face" | "tipo">> = [];

  if (nivel === 3) {
    paresDeContas(quantos, rng).forEach(([conta, resultado], parId) => {
      faces.push({ parId, face: conta, tipo: "conta" });
      faces.push({ parId, face: resultado, tipo: "resultado" });
    });
  } else {
    embaralhar([...EMOJIS], rng)
      .slice(0, quantos)
      .forEach((emoji, parId) => {
        faces.push({ parId, face: emoji, tipo: "emoji" });
        faces.push({ parId, face: emoji, tipo: "emoji" });
      });
  }

  return {
    nivel,
    cartas: embaralhar(faces, rng).map((f, id) => ({ id, ...f })),
    abertas: [],
    removidas: [],
    tentativas: 0,
    fase: "livre",
  };
}

/**
 * Toque numa carta. Evento fora de hora devolve o MESMO estado (referência
 * igual): toques durante "resolvendo", em carta aberta ou removida são no-op.
 */
export function tocarCarta(estado: EstadoTabuleiro, id: number): EstadoTabuleiro {
  if (estado.fase === "resolvendo" || estado.fase === "completa") return estado;
  if (estado.abertas.includes(id) || estado.removidas.includes(id)) return estado;
  const carta = estado.cartas.find((c) => c.id === id);
  if (!carta) return estado;

  if (estado.fase === "livre") {
    return { ...estado, abertas: [id], fase: "uma-aberta" };
  }

  // uma-aberta + segunda carta = par revelado (tentativa conta AQUI)
  const [primeira] = estado.abertas;
  const parceira = estado.cartas.find((c) => c.id === primeira)!;
  const tentativas = estado.tentativas + 1;

  if (parceira.parId === carta.parId) {
    const removidas = [...estado.removidas, primeira, id];
    const completa = removidas.length === estado.cartas.length;
    return { ...estado, abertas: [], removidas, tentativas, fase: completa ? "completa" : "livre" };
  }
  return { ...estado, abertas: [primeira, id], tentativas, fase: "resolvendo" };
}

/** O evento dos 900ms: fecha as duas cartas diferentes e libera o tabuleiro. */
export function fecharCartas(estado: EstadoTabuleiro): EstadoTabuleiro {
  if (estado.fase !== "resolvendo") return estado;
  return { ...estado, abertas: [], fase: "livre" };
}

export function proximoNivelMemoria(nivel: NivelMemoria): NivelMemoria {
  return nivel >= NIVEL_MAXIMO_MEMORIA ? NIVEL_MAXIMO_MEMORIA : ((nivel + 1) as NivelMemoria);
}
