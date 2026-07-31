import { QUIRAL, SIMETRIA, VERTICES } from "./dados";
import type { Alvo, NomePeca, Pose } from "./dados";

/**
 * Motor do Tangram — SPEC onda 3 §3.3, lógica pura.
 * Tolerâncias FECHADAS: 16px lógicos de distância; rotação módulo a simetria
 * da peça; espelho tem de bater NOS DOIS sentidos (peça quiral).
 */

export const TOLERANCIA_ENCAIXE = 16;
export const PECAS: NomePeca[] = ["g1", "g2", "m", "p1", "p2", "q", "para"];

function anguloEquivale(a: number, b: number, simetria: number): boolean {
  const diferenca = ((a - b) % simetria + simetria) % simetria;
  return diferenca < 1e-6 || Math.abs(diferenca - simetria) < 1e-6;
}

export function verificarEncaixe(peca: NomePeca, pose: Pose, alvo: Alvo): boolean {
  if (alvo.peca !== peca) return false;
  const distancia = Math.hypot(pose.x - alvo.x, pose.y - alvo.y);
  if (distancia > TOLERANCIA_ENCAIXE) return false;
  if (QUIRAL[peca] && pose.espelhado !== alvo.espelhado) return false;
  return anguloEquivale(pose.rotacao, alvo.rotacao, SIMETRIA[peca]);
}

/** Vértices da peça no tabuleiro para a pose dada (render + testes). */
export function verticesNoTabuleiro(peca: NomePeca, pose: Pose): [number, number][] {
  const rad = (pose.rotacao * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sen = Math.sin(rad);
  return VERTICES[peca].map(([x, y]) => {
    const ex = pose.espelhado ? -x : x;
    return [
      Math.round((ex * cos - y * sen + pose.x) * 10) / 10,
      Math.round((ex * sen + y * cos + pose.y) * 10) / 10,
    ];
  });
}

export function bboxDaPose(peca: NomePeca, pose: Pose) {
  const pontos = verticesNoTabuleiro(peca, pose);
  const xs = pontos.map(([x]) => x);
  const ys = pontos.map(([, y]) => y);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}
