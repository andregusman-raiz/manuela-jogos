/**
 * Dado determinístico da casa (SPEC-jogos-tabuleiro §0): LCG de Park-Miller,
 * o MESMO usado nos outros jogos. A UI lê `?semente=` da URL; o E2E navega com
 * semente fixa, recria este dado e re-executa o motor — dados 100%
 * reproduzíveis sem mock.
 */

export function criarDado(semente: number): () => 1 | 2 | 3 | 4 | 5 | 6 {
  let x = semente % 2147483647;
  if (x <= 0) x += 2147483646;
  return () => {
    x = (x * 16807) % 2147483647;
    return ((x % 6) + 1) as 1 | 2 | 3 | 4 | 5 | 6;
  };
}

/** Sorteio [0,1) com o mesmo LCG — para IAs com fração de aleatoriedade. */
export function criarSorte(semente: number): () => number {
  let x = semente % 2147483647;
  if (x <= 0) x += 2147483646;
  return () => {
    x = (x * 16807) % 2147483647;
    return (x - 1) / 2147483646;
  };
}

/** Semente vinda da URL (`?semente=`) ou do relógio. */
export function sementeInicial(busca: string): number {
  const parametro = new URLSearchParams(busca).get("semente");
  const n = parametro === null ? NaN : Number.parseInt(parametro, 10);
  if (Number.isFinite(n) && n > 0) return n;
  return (Date.now() % 2147483647) || 1;
}
