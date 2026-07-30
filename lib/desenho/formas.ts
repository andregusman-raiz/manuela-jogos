import type { OperacaoCarimbo, OperacaoForma, TipoForma } from "./tipos";

/**
 * Formas e carimbos.
 *
 * Os carimbos são EMOJI, não imagens: variedade enorme sem baixar um byte,
 * ficam nítidos em qualquer tela e desenham direto no canvas na hora de
 * exportar o PNG.
 */

export const CARIMBOS = [
  "⭐",
  "❤️",
  "🌈",
  "🌸",
  "🦋",
  "🐱",
  "🐶",
  "🦄",
  "🐢",
  "🐝",
  "🌞",
  "🌙",
  "☁️",
  "🍦",
  "🍓",
  "🎈",
  "🎀",
  "✨",
  "🐠",
  "🌺",
] as const;

export const FORMAS: Array<{ tipo: TipoForma; emoji: string; nome: string }> = [
  { tipo: "linha", emoji: "📏", nome: "linha" },
  { tipo: "circulo", emoji: "⭕", nome: "círculo" },
  { tipo: "quadrado", emoji: "🟦", nome: "quadrado" },
  { tipo: "coracao", emoji: "💗", nome: "coração" },
  { tipo: "estrela", emoji: "🌟", nome: "estrela" },
];

export function desenharCarimbo(
  ctx: CanvasRenderingContext2D,
  op: OperacaoCarimbo,
): void {
  ctx.save();
  ctx.translate(op.x, op.y);
  ctx.rotate(op.giro);
  ctx.font = `${op.tamanho}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(op.emoji, 0, 0);
  ctx.restore();
}

function caminhoCoracao(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(cx, cy + r * 0.75);
  ctx.bezierCurveTo(cx - r * 1.5, cy - r * 0.4, cx - r * 0.5, cy - r * 1.25, cx, cy - r * 0.45);
  ctx.bezierCurveTo(cx + r * 0.5, cy - r * 1.25, cx + r * 1.5, cy - r * 0.4, cx, cy + r * 0.75);
  ctx.closePath();
}

function caminhoEstrela(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const raio = i % 2 === 0 ? r : r * 0.45;
    const ang = (Math.PI / 5) * i - Math.PI / 2;
    const x = cx + Math.cos(ang) * raio;
    const y = cy + Math.sin(ang) * raio;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

export function desenharForma(ctx: CanvasRenderingContext2D, op: OperacaoForma): void {
  const { x1, y1, x2, y2, forma, cor, espessura, preenchida } = op;
  ctx.save();
  ctx.strokeStyle = cor;
  ctx.fillStyle = cor;
  ctx.lineWidth = espessura;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const cx = (x1 + x2) / 2;
  const cy = (y1 + y2) / 2;
  const raio = Math.max(4, Math.hypot(x2 - x1, y2 - y1) / 2);

  switch (forma) {
    case "linha":
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      break;
    case "circulo":
      ctx.beginPath();
      ctx.ellipse(cx, cy, Math.abs(x2 - x1) / 2 || raio, Math.abs(y2 - y1) / 2 || raio, 0, 0, Math.PI * 2);
      if (preenchida) ctx.fill();
      else ctx.stroke();
      break;
    case "quadrado":
      ctx.beginPath();
      ctx.roundRect(
        Math.min(x1, x2),
        Math.min(y1, y2),
        Math.abs(x2 - x1) || raio,
        Math.abs(y2 - y1) || raio,
        10,
      );
      if (preenchida) ctx.fill();
      else ctx.stroke();
      break;
    case "coracao":
      caminhoCoracao(ctx, cx, cy, raio);
      if (preenchida) ctx.fill();
      else ctx.stroke();
      break;
    case "estrela":
      caminhoEstrela(ctx, cx, cy, raio);
      if (preenchida) ctx.fill();
      else ctx.stroke();
      break;
  }

  ctx.restore();
}
