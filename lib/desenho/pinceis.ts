import type { OperacaoTraco, Ponto, Simetria, TipoPincel } from "./tipos";

/**
 * Desenho dos traços.
 *
 * Duas decisões importantes aqui:
 *
 * 1. O traço inteiro é redesenhado a cada quadro na camada de prévia, em vez de
 *    ir emendando pedacinhos. Assim o traço ao vivo e o traço reconstruído
 *    depois de um desfazer usam EXATAMENTE o mesmo código — nunca "muda de cara"
 *    ao desfazer.
 * 2. Pincéis com granulado (spray, giz, glitter) sorteiam com semente fixa
 *    derivada do índice do ponto. Aleatório de verdade faria as partículas
 *    pularem a cada quadro.
 */

/** Gerador determinístico (mulberry32) — mesma semente, mesmo granulado. */
function sorteio(semente: number): () => number {
  let s = semente >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Largura do traço no ponto: pincel macio afina quando o dedo corre. */
function largura(pincel: TipoPincel, espessura: number, f: number): number {
  switch (pincel) {
    case "lapis":
      return espessura * (0.45 + 0.3 * f);
    case "pincel":
      return espessura * (0.3 + 1.0 * f);
    case "marcador":
      return espessura;
    case "giz":
      return espessura * (0.6 + 0.4 * f);
    case "neon":
      return espessura * (0.5 + 0.4 * f);
    case "arcoiris":
      return espessura * (0.5 + 0.6 * f);
    case "glitter":
      return espessura * (0.5 + 0.5 * f);
    case "borracha":
      return espessura * 1.15;
    default:
      return espessura;
  }
}

function alfa(pincel: TipoPincel): number {
  switch (pincel) {
    case "lapis":
      return 0.92;
    case "marcador":
      return 0.75;
    case "giz":
      return 0.5;
    default:
      return 1;
  }
}

type Matriz = { rot: number; ex: number; ey: number };

/**
 * Espelhos e rotações da simetria, aplicados como transformação do contexto:
 * 2 = borboleta · 4 = quatro quadrantes · 8 = mandala fechada.
 */
function matrizes(simetria: Simetria): Matriz[] {
  if (simetria === 1) return [{ rot: 0, ex: 1, ey: 1 }];
  if (simetria === 2)
    return [
      { rot: 0, ex: 1, ey: 1 },
      { rot: 0, ex: -1, ey: 1 },
    ];
  if (simetria === 4)
    return [
      { rot: 0, ex: 1, ey: 1 },
      { rot: 0, ex: -1, ey: 1 },
      { rot: 0, ex: 1, ey: -1 },
      { rot: 0, ex: -1, ey: -1 },
    ];
  // 8: quatro rotações de 90° com e sem espelho = mandala fechada
  const saida: Matriz[] = [];
  for (const rot of [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]) {
    saida.push({ rot, ex: 1, ey: 1 });
    saida.push({ rot, ex: -1, ey: 1 });
  }
  return saida;
}

/** Ponto médio — usado no alisamento por curvas quadráticas. */
function meio(a: Ponto, b: Ponto): { x: number; y: number } {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function corDoArcoIris(indice: number): string {
  return `hsl(${(indice * 7) % 360} 85% 55%)`;
}

/** Desenha um traço completo (ao vivo ou reconstruído). */
export function desenharTraco(
  ctx: CanvasRenderingContext2D,
  op: OperacaoTraco,
  tela: { largura: number; altura: number },
): void {
  const pontos = op.pontos;
  if (pontos.length === 0) return;

  for (const m of matrizes(op.simetria)) {
    ctx.save();
    if (op.simetria !== 1) {
      ctx.translate(tela.largura / 2, tela.altura / 2);
      if (m.rot) ctx.rotate(m.rot);
      ctx.scale(m.ex, m.ey);
      ctx.translate(-tela.largura / 2, -tela.altura / 2);
    }
    desenharUmaVez(ctx, op, pontos);
    ctx.restore();
  }
}

/**
 * Passa a linha pelos pontos com curvas quadráticas (cada segmento vai do meio
 * do par anterior ao meio do par atual, curvando no ponto do meio).
 *
 * `fator` encolhe a espessura — usado pelo núcleo claro do neon.
 */
function tracarLinha(
  ctx: CanvasRenderingContext2D,
  op: OperacaoTraco,
  pontos: Ponto[],
  corFixa: string | null,
  fator = 1,
): void {
  const { pincel, cor, espessura } = op;

  for (let i = 1; i < pontos.length; i++) {
    const a = pontos[i - 1];
    const b = pontos[i];
    ctx.strokeStyle = corFixa ?? (pincel === "arcoiris" ? corDoArcoIris(i) : cor);
    ctx.lineWidth = Math.max(1, largura(pincel, espessura, b.f) * fator);

    const de = i === 1 ? a : meio(pontos[i - 2], a);
    const para = meio(a, b);
    ctx.beginPath();
    ctx.moveTo(de.x, de.y);
    ctx.quadraticCurveTo(a.x, a.y, para.x, para.y);
    ctx.stroke();
  }

  // fecha o último pedacinho até o ponto final
  const ultimo = pontos[pontos.length - 1];
  const penultimo = pontos[pontos.length - 2];
  ctx.strokeStyle = corFixa ?? (pincel === "arcoiris" ? corDoArcoIris(pontos.length) : cor);
  ctx.lineWidth = Math.max(1, largura(pincel, espessura, ultimo.f) * fator);
  ctx.beginPath();
  ctx.moveTo(meio(penultimo, ultimo).x, meio(penultimo, ultimo).y);
  ctx.lineTo(ultimo.x, ultimo.y);
  ctx.stroke();
}

function desenharUmaVez(
  ctx: CanvasRenderingContext2D,
  op: OperacaoTraco,
  pontos: Ponto[],
): void {
  const { pincel, cor, espessura } = op;

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.globalAlpha = alfa(pincel);

  if (pincel === "borracha") ctx.globalCompositeOperation = "destination-out";

  // Um ponto só = pingo (tocar e soltar sem arrastar precisa marcar).
  if (pontos.length === 1) {
    const p = pontos[0];
    if (pincel === "spray") {
      borrifar(ctx, p, espessura, cor, 0);
    } else {
      ctx.fillStyle = pincel === "arcoiris" ? corDoArcoIris(0) : cor;
      if (pincel === "neon") {
        ctx.shadowColor = cor;
        ctx.shadowBlur = espessura * 1.4;
      }
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(1, largura(pincel, espessura, p.f) / 2), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    return;
  }

  if (pincel === "spray") {
    for (let i = 1; i < pontos.length; i++) borrifar(ctx, pontos[i], espessura, cor, i);
    ctx.restore();
    return;
  }

  if (pincel === "neon") {
    // DOIS passes, na ordem: primeiro o brilho inteiro, depois o núcleo claro.
    // Fazendo segmento a segmento, o brilho do segmento seguinte apagava o
    // núcleo do anterior e a luz saía picada.
    ctx.shadowColor = cor;
    ctx.shadowBlur = espessura * 1.4;
    tracarLinha(ctx, op, pontos, cor);
    ctx.shadowBlur = 0;
    tracarLinha(ctx, op, pontos, "rgba(255,255,255,0.85)", 0.35);
    ctx.restore();
    return;
  }

  tracarLinha(ctx, op, pontos, null);

  if (pincel === "giz") {
    for (let i = 1; i < pontos.length; i++) {
      riscarGiz(ctx, pontos[i - 1], pontos[i], espessura, i);
    }
  }
  if (pincel === "glitter") {
    for (let i = 1; i < pontos.length; i++) brilhar(ctx, pontos[i], espessura, i);
  }

  ctx.restore();
}

function borrifar(
  ctx: CanvasRenderingContext2D,
  p: Ponto,
  espessura: number,
  cor: string,
  semente: number,
): void {
  const rnd = sorteio(semente * 9301 + 49297);
  const raio = espessura * 0.9;
  const pingos = 6 + Math.floor(espessura / 6);
  ctx.fillStyle = cor;
  ctx.globalAlpha = 0.5;
  for (let i = 0; i < pingos; i++) {
    const ang = rnd() * Math.PI * 2;
    const dist = rnd() * raio;
    ctx.beginPath();
    ctx.arc(p.x + Math.cos(ang) * dist, p.y + Math.sin(ang) * dist, 0.8 + rnd() * 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function riscarGiz(
  ctx: CanvasRenderingContext2D,
  a: Ponto,
  b: Ponto,
  espessura: number,
  semente: number,
): void {
  const rnd = sorteio(semente * 7919);
  ctx.save();
  ctx.globalAlpha = 0.28;
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 3; i++) {
    const dx = (rnd() - 0.5) * espessura * 0.8;
    const dy = (rnd() - 0.5) * espessura * 0.8;
    ctx.beginPath();
    ctx.moveTo(a.x + dx, a.y + dy);
    ctx.lineTo(b.x + dx, b.y + dy);
    ctx.stroke();
  }
  ctx.restore();
}

function brilhar(
  ctx: CanvasRenderingContext2D,
  p: Ponto,
  espessura: number,
  semente: number,
): void {
  const rnd = sorteio(semente * 104729);
  if (rnd() > 0.45) return;
  ctx.save();
  ctx.fillStyle = rnd() > 0.5 ? "#FFFFFF" : "#F8DE7B";
  const r = 1 + rnd() * 2.2;
  const ang = rnd() * Math.PI * 2;
  const d = rnd() * espessura * 0.7;
  ctx.beginPath();
  ctx.arc(p.x + Math.cos(ang) * d, p.y + Math.sin(ang) * d, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
