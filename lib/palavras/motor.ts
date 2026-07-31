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

function silabasAlheias(dona: Palavra): string[] {
  return [
    ...new Set(PALAVRAS.filter((p) => p.palavra !== dona.palavra).flatMap((p) => p.silabas)),
  ];
}

/**
 * Sílaba ELEGÍVEL para virar lacuna: 2+ letras (lacuna de "A" é trivial) e com
 * pelo menos 3 distratoras do MESMO tamanho no banco — a regra da SPEC é
 * fechada em "mesmo nº de letras", então quem não tem vizinhança não é
 * sorteada (ex.: PRIN/QUEI são as únicas de 4 letras).
 */
function silabaElegivel(silaba: string, dona: Palavra): boolean {
  if (silaba.length < 2) return false;
  const iguais = silabasAlheias(dona).filter(
    (s) => s !== silaba && s.length === silaba.length,
  );
  return iguais.length >= 3;
}

/** Distratores de sílaba: OUTRAS palavras do banco, MESMO tamanho (SPEC §4.4). */
function opcoesDeSilaba(certa: string, dona: Palavra, rng: () => number): string[] {
  const mesmoTamanho = silabasAlheias(dona).filter(
    (s) => s !== certa && s.length === certa.length,
  );
  const opcoes = new Set<string>([certa]);
  for (const s of embaralhar(mesmoTamanho, rng)) {
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
  const elegiveis = item.silabas
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => silabaElegivel(s, item));
  const escolhida = elegiveis[Math.floor(rng() * elegiveis.length)];
  const indice = escolhida.i;
  const resposta = escolhida.s;
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
  // nível 1/2 filtram por dificuldade; nível 3 exige palavra com pelo menos
  // uma sílaba elegível (2+ letras e vizinhança de mesmo tamanho no banco)
  const pool =
    nivel === 3
      ? PALAVRAS.filter((p) => p.silabas.some((s) => silabaElegivel(s, p)))
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
