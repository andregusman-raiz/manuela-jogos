/**
 * Geometria visual do trilho (SPEC-jogos-corrida §1.3) — a conversão
 * progresso→ponto é NOSSA (polyline por trecho), nunca getPointAtLength do
 * DOM: o motor é a verdade e o teste de unidade cobre o mapeamento.
 *
 * Unidade visual (vu) = 1/10 da unidade lógica do motor, mas o comprimento
 * visual de cada peça NÃO precisa ser proporcional ao trecho lógico: a
 * interpolação é por fração DENTRO do trecho, então o desenho pode ser
 * bonito sem mentir sobre a física.
 */

import { PISTAS, comprimentoTotal, inicioDoTrecho, trechoEm } from "./motor";
import type { NivelAutorama } from "./motor";

export interface AmostraTrilho {
  x: number;
  y: number;
  /** Ângulo da tangente em radianos (0 = leste, y cresce para baixo). */
  angulo: number;
}

type Peca =
  | { tipo: "reta"; comprimento: number }
  | { tipo: "arco"; raio: number; giro: number }
  /** Reta desenhada até o ponto de largada — garante fechamento exato. */
  | { tipo: "fecho" };

/** Uma peça visual POR TRECHO lógico (mesmos índices da pista do motor). */
const PECAS: Record<NivelAutorama, Peca[]> = {
  1: [
    { tipo: "reta", comprimento: 70 },
    { tipo: "arco", raio: 12, giro: Math.PI },
    { tipo: "reta", comprimento: 70 },
    { tipo: "arco", raio: 12, giro: Math.PI },
  ],
  2: [
    { tipo: "reta", comprimento: 50 },
    { tipo: "arco", raio: 12, giro: Math.PI },
    { tipo: "reta", comprimento: 15 },
    { tipo: "arco", raio: 10, giro: Math.PI / 3 },
    { tipo: "arco", raio: 10, giro: -Math.PI / 3 },
    { tipo: "reta", comprimento: 54.7 },
    { tipo: "arco", raio: 7, giro: Math.PI },
    { tipo: "fecho" },
  ],
};

interface TrilhoVisual {
  /** Amostras por trecho, com comprimento visual acumulado por amostra. */
  trechos: { amostras: AmostraTrilho[]; acumulado: number[] }[];
  caixa: { x: number; y: number; largura: number; altura: number };
}

const CACHE: Partial<Record<NivelAutorama, TrilhoVisual>> = {};

function construir(nivel: NivelAutorama): TrilhoVisual {
  let x = 0;
  let y = 0;
  let angulo = 0;
  const trechos: TrilhoVisual["trechos"] = [];

  for (const peca of PECAS[nivel]) {
    const amostras: AmostraTrilho[] = [{ x, y, angulo }];
    if (peca.tipo === "arco") {
      const passos = Math.max(8, Math.ceil((Math.abs(peca.giro) / Math.PI) * 24));
      const dAngulo = peca.giro / passos;
      const dS = (peca.raio * Math.abs(peca.giro)) / passos;
      for (let i = 0; i < passos; i++) {
        // integração pelo ponto médio: raio fica fiel mesmo com poucos passos
        x += dS * Math.cos(angulo + dAngulo / 2);
        y += dS * Math.sin(angulo + dAngulo / 2);
        angulo += dAngulo;
        amostras.push({ x, y, angulo });
      }
    } else {
      const [alvoX, alvoY] =
        peca.tipo === "fecho"
          ? [0, 0]
          : [x + peca.comprimento * Math.cos(angulo), y + peca.comprimento * Math.sin(angulo)];
      angulo = peca.tipo === "fecho" ? Math.atan2(alvoY - y, alvoX - x) : angulo;
      amostras[0] = { x, y, angulo };
      x = alvoX;
      y = alvoY;
      amostras.push({ x, y, angulo });
    }
    const acumulado = amostras.map((_, i) =>
      i === 0
        ? 0
        : amostras
            .slice(1, i + 1)
            .reduce((s, a, j) => s + Math.hypot(a.x - amostras[j].x, a.y - amostras[j].y), 0),
    );
    trechos.push({ amostras, acumulado });
  }

  // deriva numérica do último arco: encostar a emenda na largada
  const ultimo = trechos[trechos.length - 1];
  const fim = ultimo.amostras[ultimo.amostras.length - 1];
  fim.x = 0;
  fim.y = 0;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const t of trechos)
    for (const a of t.amostras) {
      minX = Math.min(minX, a.x);
      minY = Math.min(minY, a.y);
      maxX = Math.max(maxX, a.x);
      maxY = Math.max(maxY, a.y);
    }
  const margem = 10;
  return {
    trechos,
    caixa: {
      x: minX - margem,
      y: minY - margem,
      largura: maxX - minX + 2 * margem,
      altura: maxY - minY + 2 * margem,
    },
  };
}

function trilho(nivel: NivelAutorama): TrilhoVisual {
  return (CACHE[nivel] ??= construir(nivel));
}

/** Ponto (e tangente) do carro para um progresso do motor, com o
 *  deslocamento perpendicular da pista dele (2 slots lado a lado). */
export function pontoNoTrilho(
  nivel: NivelAutorama,
  progresso: number,
  deslocamento: number,
): AmostraTrilho {
  const pista = PISTAS[nivel];
  const total = comprimentoTotal(pista);
  const p = ((progresso % total) + total) % total;
  const indice = trechoEm(pista, p);
  const fracao = (p - inicioDoTrecho(pista, indice)) / pista[indice].comprimento;

  const { amostras, acumulado } = trilho(nivel).trechos[indice];
  const alvo = fracao * acumulado[acumulado.length - 1];
  let i = 1;
  while (i < acumulado.length - 1 && acumulado[i] < alvo) i++;
  const antes = amostras[i - 1];
  const depois = amostras[i];
  const faixa = acumulado[i] - acumulado[i - 1];
  const t = faixa > 0 ? (alvo - acumulado[i - 1]) / faixa : 0;
  const angulo = antes.angulo + (depois.angulo - antes.angulo) * t;
  const x = antes.x + (depois.x - antes.x) * t + Math.cos(angulo + Math.PI / 2) * deslocamento;
  const y = antes.y + (depois.y - antes.y) * t + Math.sin(angulo + Math.PI / 2) * deslocamento;
  return { x, y, angulo };
}

/** Pontos de <polyline> do trilho inteiro com deslocamento perpendicular. */
export function pontosDaLinha(nivel: NivelAutorama, deslocamento: number): string {
  const pontos: string[] = [];
  for (const t of trilho(nivel).trechos)
    for (const a of t.amostras) {
      const x = a.x + Math.cos(a.angulo + Math.PI / 2) * deslocamento;
      const y = a.y + Math.sin(a.angulo + Math.PI / 2) * deslocamento;
      pontos.push(`${x.toFixed(2)},${y.toFixed(2)}`);
    }
  const primeiro = pontos[0];
  pontos.push(primeiro); // fecha o laço
  return pontos.join(" ");
}

export function viewBoxDoTrilho(nivel: NivelAutorama): string {
  const { caixa } = trilho(nivel);
  return `${caixa.x.toFixed(1)} ${caixa.y.toFixed(1)} ${caixa.largura.toFixed(1)} ${caixa.altura.toFixed(1)}`;
}
