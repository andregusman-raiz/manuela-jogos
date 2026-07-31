import { criarRng } from "@/lib/contas/motor";
import { PRODUTOS } from "./dados";

/**
 * Motor da Lojinha — SPEC onda 2 §3.3. TUDO em CENTAVOS INTEIROS (nunca
 * float). O preço nasce da SOMA de peças sorteadas: pagável por construção —
 * nada de greedy ({2,5,10,20} nem é canônico; lição do juiz).
 */

export { criarRng };

/** Notas estilizadas (centavos): R$ 2, 5, 10, 20. */
export const NOTAS = [200, 500, 1000, 2000] as const;
/** Moedas: 25c, 50c, R$ 1. */
export const MOEDAS = [25, 50, 100] as const;

export const COMPRAS_POR_FASE = 8;
export type NivelLojinha = 1 | 2 | 3;
export const NIVEL_MAXIMO_LOJINHA: NivelLojinha = 3;

export type RodadaLojinha = {
  produto: { emoji: string; nome: string };
  /** centavos */
  preco: number;
  /** peças disponíveis no caixa (valores únicos, ordenados) */
  pecas: number[];
  /** nível 3: com quanto pagou e as opções de troco (centavos) */
  pagamento?: number;
  opcoesTroco?: number[];
};

export function pecasDoNivel(nivel: NivelLojinha): number[] {
  return nivel === 1 ? [...NOTAS] : [...MOEDAS, ...NOTAS];
}

export function formatar(centavos: number): string {
  const reais = Math.floor(centavos / 100);
  const resto = centavos % 100;
  return resto === 0 ? `R$ ${reais}` : `R$ ${reais},${String(resto).padStart(2, "0")}`;
}

function embaralhar<T>(itens: T[], rng: () => number): T[] {
  const copia = [...itens];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

export function gerarRodada(nivel: NivelLojinha, rng: () => number): RodadaLojinha {
  const produto = PRODUTOS[Math.floor(rng() * PRODUTOS.length)];
  const pecas = pecasDoNivel(nivel);

  if (nivel === 3) {
    // preço na grade de 25c entre R$1,00 e R$18,75; pagamento = menor nota
    // estritamente maior — troco SEMPRE > 0
    const preco = 100 + Math.floor(rng() * ((1875 - 100) / 25 + 1)) * 25;
    const pagamento = [500, 1000, 2000].find((n) => n > preco)!;
    const certo = pagamento - preco;
    const candidatos = [certo + 25, certo - 25, certo + 100, certo - 100, preco];
    const opcoes = new Set<number>([certo]);
    for (const c of candidatos) {
      if (opcoes.size === 4) break;
      if (c > 0 && c !== certo) opcoes.add(c);
    }
    for (let d = 2; opcoes.size < 4; d++) opcoes.add(certo + d * 100);
    return { produto, preco, pecas, pagamento, opcoesTroco: embaralhar([...opcoes], rng) };
  }

  // níveis 1-2: sorteia 2 a 5 peças (com repetição) e o preço É a soma
  const quantas = 2 + Math.floor(rng() * 4);
  let preco = 0;
  for (let i = 0; i < quantas; i++) preco += pecas[Math.floor(rng() * pecas.length)];
  return { produto, preco, pecas };
}

/**
 * Toque numa peça do caixa. Se estourar o preço, a peça NÃO entra (ela "volta
 * sozinha" — o componente treme o visor): pilha devolvida inalterada.
 */
export function tocarPeca(
  pilha: number[],
  peca: number,
  preco: number,
): { pilha: number[]; estourou: boolean } {
  const soma = pilha.reduce((s, p) => s + p, 0) + peca;
  if (soma > preco) return { pilha, estourou: true };
  return { pilha: [...pilha, peca], estourou: false };
}

/** Devolve a peça na posição i do visor; posição inválida é no-op. */
export function devolverPeca(pilha: number[], indice: number): number[] {
  if (indice < 0 || indice >= pilha.length) return pilha;
  return pilha.filter((_, i) => i !== indice);
}

export function somaDe(pilha: number[]): number {
  return pilha.reduce((s, p) => s + p, 0);
}

export function proximoNivelLojinha(nivel: NivelLojinha): NivelLojinha {
  return nivel >= NIVEL_MAXIMO_LOJINHA ? NIVEL_MAXIMO_LOJINHA : ((nivel + 1) as NivelLojinha);
}
