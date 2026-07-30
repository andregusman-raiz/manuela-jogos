import { criarRng } from "@/lib/contas/motor";
import { PALAVRAS, type Palavra } from "./dados";
import type { NivelPalavras, Rodada } from "./tipos";

/**
 * Motor da Palavra Mágica — SPEC §4.4. O contrato é `gerarFase`: a fase
 * INTEIRA nasce de uma vez, sem palavra repetida (não existe rodada avulsa).
 */

export { criarRng };

export const RODADAS_POR_FASE = 8;
export const NIVEL_MAXIMO_PALAVRAS: NivelPalavras = 3;

/** Pares fonética/visualmente próximos — é onde mora o valor pedagógico. */
const VIZINHAS: Record<string, string[]> = {
  P: ["B", "T", "R"],
  B: ["P", "D", "R"],
  T: ["D", "P", "L"],
  D: ["T", "B", "P"],
  F: ["V", "T", "J"],
  V: ["F", "U", "N"],
  M: ["N", "W", "U"],
  N: ["M", "U", "R"],
  C: ["G", "Q", "S"],
  G: ["C", "Q", "J"],
  S: ["Z", "C", "X"],
  Z: ["S", "X", "J"],
  E: ["I", "A", "O"],
  I: ["E", "U", "L"],
  O: ["U", "A", "E"],
  U: ["O", "I", "V"],
  A: ["E", "O", "Ã"],
};

const ALFABETO = "ABCDEFGHIJLMNOPQRSTUVXZ";

function embaralhar<T>(itens: T[], rng: () => number): T[] {
  const copia = [...itens];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

function opcoesDeLetra(letra: string, rng: () => number): string[] {
  const opcoes = new Set<string>([letra]);
  for (const vizinha of VIZINHAS[letra] ?? []) {
    if (opcoes.size === 4) break;
    if (vizinha !== letra) opcoes.add(vizinha);
  }
  for (const extra of embaralhar([...ALFABETO], rng)) {
    if (opcoes.size === 4) break;
    if (extra !== letra) opcoes.add(extra);
  }
  return embaralhar([...opcoes], rng);
}

/** Distratores de sílaba: sílabas de OUTRAS palavras do banco, mesmo tamanho
 *  (regra determinística da SPEC; relaxa para ±1 letra se faltar candidata). */
function opcoesDeSilaba(certa: string, dona: Palavra, rng: () => number): string[] {
  const alheias = [
    ...new Set(
      PALAVRAS.filter((p) => p.palavra !== dona.palavra)
        .flatMap((p) => p.silabas)
        .filter((s) => s !== certa),
    ),
  ];
  const mesmoTamanho = alheias.filter((s) => s.length === certa.length);
  const quase = alheias.filter((s) => Math.abs(s.length - certa.length) === 1);

  const opcoes = new Set<string>([certa]);
  for (const s of embaralhar(mesmoTamanho, rng)) {
    if (opcoes.size === 4) break;
    opcoes.add(s);
  }
  for (const s of embaralhar(quase, rng)) {
    if (opcoes.size === 4) break;
    opcoes.add(s);
  }
  return embaralhar([...opcoes], rng);
}

function rodadaDeLetra(item: Palavra, rng: () => number): Rodada {
  const inicio = Math.floor(rng() * item.palavra.length);
  const letra = item.palavra[inicio];
  return {
    palavra: item.palavra,
    emoji: item.emoji,
    inicio,
    fim: inicio + 1,
    resposta: letra,
    opcoes: opcoesDeLetra(letra, rng),
  };
}

function rodadaDeSilaba(item: Palavra, rng: () => number): Rodada {
  const indice = Math.floor(rng() * item.silabas.length);
  const resposta = item.silabas[indice];
  const inicio = item.silabas.slice(0, indice).join("").length;
  return {
    palavra: item.palavra,
    emoji: item.emoji,
    inicio,
    fim: inicio + resposta.length,
    resposta,
    opcoes: opcoesDeSilaba(resposta, item, rng),
  };
}

export function gerarFase(nivel: NivelPalavras, seed: number): Rodada[] {
  const rng = criarRng(seed);
  // nível 1/2 filtram por dificuldade; nível 3 usa o banco todo (2+ sílabas)
  const pool =
    nivel === 3
      ? PALAVRAS.filter((p) => p.silabas.length >= 2)
      : PALAVRAS.filter((p) => p.nivel === nivel);

  return embaralhar(pool, rng)
    .slice(0, RODADAS_POR_FASE)
    .map((item) => (nivel === 3 ? rodadaDeSilaba(item, rng) : rodadaDeLetra(item, rng)));
}

export function responder(rodada: Rodada, opcao: string): boolean {
  return opcao === rodada.resposta;
}

export function proximoNivelPalavras(nivel: NivelPalavras): NivelPalavras {
  return nivel >= NIVEL_MAXIMO_PALAVRAS ? NIVEL_MAXIMO_PALAVRAS : ((nivel + 1) as NivelPalavras);
}
