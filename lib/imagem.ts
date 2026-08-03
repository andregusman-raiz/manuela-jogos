/**
 * Processamento de imagem para perfis dinâmicos — funções PURAS sobre
 * pixels RGBA (SPEC-perfis-pela-interface §5). Sem canvas aqui: testável em
 * unit; os wrappers com canvas vivem em lib/imagem-canvas.ts.
 *
 * Fila do BFS em Uint32Array (juiz B7: Array.shift() é proibido — medido
 * ~5ms/megapixel com fila tipada).
 */

export const LIMIAR_FUNDO = 245;

export interface Pixels {
  dados: Uint8ClampedArray; // RGBA
  largura: number;
  altura: number;
}

function quaseBranco(dados: Uint8ClampedArray, i: number): boolean {
  return (
    dados[i] >= LIMIAR_FUNDO && dados[i + 1] >= LIMIAR_FUNDO && dados[i + 2] >= LIMIAR_FUNDO
  );
}

/** A imagem já tem transparência? (aí não mexemos no fundo) */
export function temAlpha(p: Pixels): boolean {
  const { dados } = p;
  for (let i = 3; i < dados.length; i += 4) {
    if (dados[i] < 255) return true;
  }
  return false;
}

/** Heurística da borda: ≥70% dos pixels do contorno quase-brancos. */
export function fundoClaro(p: Pixels): boolean {
  const { dados, largura, altura } = p;
  let claros = 0;
  let total = 0;
  const olhar = (x: number, y: number) => {
    total++;
    if (quaseBranco(dados, (y * largura + x) * 4)) claros++;
  };
  for (let x = 0; x < largura; x++) {
    olhar(x, 0);
    olhar(x, altura - 1);
  }
  for (let y = 1; y < altura - 1; y++) {
    olhar(0, y);
    olhar(largura - 1, y);
  }
  return total > 0 && claros / total >= 0.7;
}

/**
 * Flood-fill dos 4 cantos: só o quase-branco CONECTADO à borda vira
 * transparente (olhos/dentes/meias brancos internos ficam). Depois, o
 * antisserrilhado: pixel opaco com 2+ vizinhos transparentes ganha alpha 140.
 * MUTA `p.dados` (evita cópia de megabytes) e devolve o próprio `p`.
 */
export function removerFundo(p: Pixels): Pixels {
  const { dados, largura, altura } = p;
  const total = largura * altura;
  const visitado = new Uint8Array(total);
  const fila = new Uint32Array(total);
  let inicio = 0;
  let fim = 0;

  const empurrar = (indice: number) => {
    if (!visitado[indice]) {
      visitado[indice] = 1;
      fila[fim++] = indice;
    }
  };
  for (let x = 0; x < largura; x++) {
    empurrar(x);
    empurrar((altura - 1) * largura + x);
  }
  for (let y = 0; y < altura; y++) {
    empurrar(y * largura);
    empurrar(y * largura + largura - 1);
  }

  while (inicio < fim) {
    const indice = fila[inicio++];
    const i = indice * 4;
    if (!quaseBranco(dados, i)) continue;
    dados[i + 3] = 0;
    const x = indice % largura;
    const y = (indice / largura) | 0;
    if (x > 0) empurrar(indice - 1);
    if (x < largura - 1) empurrar(indice + 1);
    if (y > 0) empurrar(indice - largura);
    if (y < altura - 1) empurrar(indice + largura);
  }

  // antisserrilhado numa passada separada (ler alpha já resolvido)
  const transparente = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < largura && y < altura && dados[(y * largura + x) * 4 + 3] === 0;
  const suavizar: number[] = [];
  for (let y = 0; y < altura; y++) {
    for (let x = 0; x < largura; x++) {
      const i = (y * largura + x) * 4;
      if (dados[i + 3] !== 255) continue;
      let vizinhos = 0;
      if (transparente(x + 1, y)) vizinhos++;
      if (transparente(x - 1, y)) vizinhos++;
      if (transparente(x, y + 1)) vizinhos++;
      if (transparente(x, y - 1)) vizinhos++;
      if (vizinhos >= 2) suavizar.push(i);
    }
  }
  for (const i of suavizar) dados[i + 3] = 140;
  return p;
}

/** Bounding box de alpha>0, ou null se a imagem inteira for transparente. */
export function caixaUtil(p: Pixels): { x: number; y: number; largura: number; altura: number } | null {
  const { dados, largura, altura } = p;
  let minX = largura;
  let minY = altura;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < altura; y++) {
    for (let x = 0; x < largura; x++) {
      if (dados[(y * largura + x) * 4 + 3] > 0) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  return { x: minX, y: minY, largura: maxX - minX + 1, altura: maxY - minY + 1 };
}
