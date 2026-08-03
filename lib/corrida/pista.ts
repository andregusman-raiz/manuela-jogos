/**
 * Pista FIXA da Corrida (SPEC §2.1) — 300 segmentos compostos por blocos,
 * nunca gerada. Os DOIS níveis usam o mesmo traçado (nível 2 = + oponentes).
 * Elevação é puramente visual (colinas desenham, não afetam física).
 */

import type { SegmentoPista } from "./motor";

function reta(quantidade: number): SegmentoPista[] {
  return Array.from({ length: quantidade }, () => ({ curva: 0, elevacao: 0 }));
}

function curva(quantidade: number, intensidade: number): SegmentoPista[] {
  return Array.from({ length: quantidade }, () => ({ curva: intensidade, elevacao: 0 }));
}

/** Colina em seno: sobe e desce suave, só no desenho. */
function colina(quantidade: number, altura: number): SegmentoPista[] {
  return Array.from({ length: quantidade }, (_, i) => ({
    curva: 0,
    elevacao: Math.sin((i / (quantidade - 1)) * Math.PI) * altura,
  }));
}

/** 300 segmentos (60 000 u): retas largas, curvas alternadas e uma colina. */
export const PISTA_CORRIDA: readonly SegmentoPista[] = [
  ...reta(40),
  ...curva(30, 0.5),
  ...reta(20),
  ...curva(30, -0.5),
  ...colina(30, 60),
  ...reta(20),
  ...curva(40, 0.35),
  ...reta(20),
  ...curva(35, -0.45),
  ...reta(35),
];
