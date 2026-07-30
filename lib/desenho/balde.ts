/**
 * Balde de tinta do desenho livre (scanline flood fill).
 *
 * Roda na thread principal de propósito: numa tela de ~1080x1920 o preenchimento
 * leva poucos milissegundos, e manter tudo síncrono deixa o DESFAZER simples e
 * determinístico (a reconstrução do desenho não precisa esperar worker nenhum).
 * Se um aparelho de entrada mostrar travada perceptível, o caminho é mover ESTA
 * função para um worker — a interface dela já isola o cálculo.
 *
 * No livro de colorir o preenchimento não passa por aqui: lá as regiões são
 * paths de SVG e a pintura é exata por construção.
 */

function hexParaRgb(hex: string): [number, number, number] {
  const limpo = hex.replace("#", "");
  const cheio =
    limpo.length === 3
      ? limpo
          .split("")
          .map((c) => c + c)
          .join("")
      : limpo;
  return [
    parseInt(cheio.slice(0, 2), 16),
    parseInt(cheio.slice(2, 4), 16),
    parseInt(cheio.slice(4, 6), 16),
  ];
}

/**
 * @param origem   contexto ACHATADO (fundo + arte) — é nele que se decide o que
 *                 é "a mesma cor", senão o balde escaparia pelo transparente.
 * @param destino  contexto onde a tinta é aplicada (camada de arte).
 * @returns        true se pintou algo.
 */
export function preencherRegiao(
  origem: CanvasRenderingContext2D,
  destino: CanvasRenderingContext2D,
  x: number,
  y: number,
  corHex: string,
  tolerancia = 40,
): boolean {
  const largura = origem.canvas.width;
  const altura = origem.canvas.height;
  const px = Math.round(x);
  const py = Math.round(y);
  if (px < 0 || py < 0 || px >= largura || py >= altura) return false;

  const dados = origem.getImageData(0, 0, largura, altura);
  const buf = dados.data;
  const inicio = (py * largura + px) * 4;
  const alvo = [buf[inicio], buf[inicio + 1], buf[inicio + 2], buf[inicio + 3]] as const;
  const [nr, ng, nb] = hexParaRgb(corHex);

  // Já é a cor pedida? Não faz nada (e não suja o histórico de desfazer).
  const distAlvoNova =
    Math.abs(alvo[0] - nr) + Math.abs(alvo[1] - ng) + Math.abs(alvo[2] - nb) + (255 - alvo[3]);
  if (distAlvoNova <= 8) return false;

  const limite = tolerancia * 3;
  const combina = (i: number): boolean => {
    const d =
      Math.abs(buf[i] - alvo[0]) +
      Math.abs(buf[i + 1] - alvo[1]) +
      Math.abs(buf[i + 2] - alvo[2]) +
      Math.abs(buf[i + 3] - alvo[3]);
    return d <= limite;
  };

  const marcado = new Uint8Array(largura * altura);
  const pilha: number[] = [px, py];

  while (pilha.length > 0) {
    const cy = pilha.pop() as number;
    const cx = pilha.pop() as number;
    let esq = cx;
    let dir = cx;
    const linha = cy * largura;

    while (esq > 0 && !marcado[linha + esq - 1] && combina((linha + esq - 1) * 4)) esq--;
    while (dir < largura - 1 && !marcado[linha + dir + 1] && combina((linha + dir + 1) * 4)) dir++;

    for (let i = esq; i <= dir; i++) {
      marcado[linha + i] = 1;
      if (cy > 0) {
        const acima = (cy - 1) * largura + i;
        if (!marcado[acima] && combina(acima * 4)) pilha.push(i, cy - 1);
      }
      if (cy < altura - 1) {
        const abaixo = (cy + 1) * largura + i;
        if (!marcado[abaixo] && combina(abaixo * 4)) pilha.push(i, cy + 1);
      }
    }
  }

  // Engrossa 1px para cobrir a borda suavizada do traço — sem isso fica um
  // anel claro entre a tinta e o contorno.
  const engrossado = new Uint8Array(marcado);
  for (let y2 = 0; y2 < altura; y2++) {
    for (let x2 = 0; x2 < largura; x2++) {
      const i = y2 * largura + x2;
      if (marcado[i]) continue;
      const vizinho =
        (x2 > 0 && marcado[i - 1]) ||
        (x2 < largura - 1 && marcado[i + 1]) ||
        (y2 > 0 && marcado[i - largura]) ||
        (y2 < altura - 1 && marcado[i + largura]);
      if (vizinho) engrossado[i] = 1;
    }
  }

  let pintou = 0;
  const tinta = new ImageData(largura, altura);
  const tbuf = tinta.data;
  for (let i = 0; i < engrossado.length; i++) {
    if (!engrossado[i]) continue;
    const j = i * 4;
    tbuf[j] = nr;
    tbuf[j + 1] = ng;
    tbuf[j + 2] = nb;
    tbuf[j + 3] = 255;
    pintou++;
  }
  if (pintou === 0) return false;

  const temp = document.createElement("canvas");
  temp.width = largura;
  temp.height = altura;
  const tctx = temp.getContext("2d");
  if (!tctx) return false;
  tctx.putImageData(tinta, 0, 0);
  destino.drawImage(temp, 0, 0);
  return true;
}
