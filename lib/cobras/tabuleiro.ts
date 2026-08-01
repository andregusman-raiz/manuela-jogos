/** Geometria boustrophedon (SPEC §2.1): casa 1 EMBAIXO-ESQUERDA; linhas
 *  ímpares (1ª, 3ª…) correm esq→dir, pares correm dir→esq; 100 no topo-esquerda. */

export const CEL = 20; // px lógicos por casa (viewBox 200)

/** Casa 1..100 → [coluna 0..9, linha 0..9 DO TOPO] no SVG. */
export function celulaDaCasa(casa: number): [number, number] {
  const linhaDeBaixo = Math.floor((casa - 1) / 10); // 0 = linha do 1..10
  const dentro = (casa - 1) % 10;
  const col = linhaDeBaixo % 2 === 0 ? dentro : 9 - dentro;
  return [col, 9 - linhaDeBaixo];
}

export function centroDaCasa(casa: number): [number, number] {
  const [col, lin] = celulaDaCasa(casa);
  return [col * CEL + CEL / 2, lin * CEL + CEL / 2];
}
