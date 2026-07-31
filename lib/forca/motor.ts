import { criarRng } from "@/lib/contas/motor";
import { PALAVRAS } from "@/lib/palavras/dados";

/**
 * Motor da Forca da Manu — lógica pura (SPEC onda 2 §3.1).
 * Versão amigável: 6 balões; perder revela a palavra e a FILA AVANÇA —
 * fase fecha após 6 palavras apresentadas, ganhas ou não. Nunca game over.
 */

export { criarRng };

export const ERROS_MAXIMOS = 6;
export const PALAVRAS_POR_FASE = 6;
/** Ganhas mínimas para liberar o "mais difícil". */
export const GANHAS_PARA_SUBIR = 4;

export type NivelForca = 1 | 2;

export type PalavraForca = { palavra: string; emoji: string };

export type Situacao = "jogando" | "ganhou-palavra" | "perdeu-palavra" | "fase-completa";

export type EstadoForca = {
  nivel: NivelForca;
  fila: PalavraForca[];
  indice: number;
  /** Letras-BASE já tentadas na palavra atual (sem acento). */
  usadas: string[];
  erros: number;
  ganhas: number;
  /** Palavras finalizadas (ganhas + reveladas). */
  jogadas: number;
  situacao: Situacao;
};

/** Letra-base: NFD sem diacrítico, maiúscula. Ç→C, Ã→A. QU são duas letras. */
export function base(caractere: string): string {
  return caractere
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase();
}

function embaralhar<T>(itens: T[], rng: () => number): T[] {
  const copia = [...itens];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

export function gerarFase(nivel: NivelForca, seed: number): EstadoForca {
  const rng = criarRng(seed);
  const fila = embaralhar(
    PALAVRAS.filter((p) => p.nivel === nivel).map(({ palavra, emoji }) => ({ palavra, emoji })),
    rng,
  ).slice(0, PALAVRAS_POR_FASE);
  return { nivel, fila, indice: 0, usadas: [], erros: 0, ganhas: 0, jogadas: 0, situacao: "jogando" };
}

export function palavraAtual(estado: EstadoForca): PalavraForca {
  return estado.fila[estado.indice];
}

/** A palavra tem esta letra-base? */
function contem(palavra: string, letraBase: string): boolean {
  return [...palavra].some((c) => base(c) === letraBase);
}

/** Todas as letras da palavra já foram tentadas? */
function completa(palavra: string, usadas: string[]): boolean {
  return [...palavra].every((c) => usadas.includes(base(c)));
}

/**
 * Tenta uma letra. Fora de "jogando", letra repetida ou não-A-Z: MESMO estado
 * (referência) — no-op por construção.
 */
export function tentar(estado: EstadoForca, letra: string): EstadoForca {
  if (estado.situacao !== "jogando") return estado;
  const b = base(letra);
  if (!/^[A-Z]$/.test(b) || estado.usadas.includes(b)) return estado;

  const { palavra } = palavraAtual(estado);
  const usadas = [...estado.usadas, b];

  if (contem(palavra, b)) {
    if (completa(palavra, usadas)) {
      return {
        ...estado,
        usadas,
        ganhas: estado.ganhas + 1,
        jogadas: estado.jogadas + 1,
        situacao: "ganhou-palavra",
      };
    }
    return { ...estado, usadas };
  }

  const erros = estado.erros + 1;
  if (erros >= ERROS_MAXIMOS) {
    // estourou o último balão: a palavra se revela e a fila avança — sem drama
    return { ...estado, usadas, erros, jogadas: estado.jogadas + 1, situacao: "perdeu-palavra" };
  }
  return { ...estado, usadas, erros };
}

/** Sai do interstício (ganhou/perdeu) para a próxima palavra ou fecha a fase. */
export function avancar(estado: EstadoForca): EstadoForca {
  if (estado.situacao !== "ganhou-palavra" && estado.situacao !== "perdeu-palavra") return estado;
  if (estado.jogadas >= PALAVRAS_POR_FASE) return { ...estado, situacao: "fase-completa" };
  return { ...estado, indice: estado.indice + 1, usadas: [], erros: 0, situacao: "jogando" };
}
