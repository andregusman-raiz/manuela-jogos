"use client";

import { useEffect, useRef } from "react";

const CORES = ["#f09bc0", "#aedede", "#f8de7b", "#edc23f", "#d9739f", "#ffffff"];

type Props = {
  /** Muda de valor a cada comemoração para disparar de novo. */
  gatilho: number;
  duracao?: number;
};

type Particula = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  giro: number;
  vgiro: number;
  lado: number;
  cor: string;
};

/**
 * Chuva de confete ao salvar o desenho — a recompensa do loop.
 *
 * Canvas próprio em cima de tudo, sem biblioteca: são 60 retângulos girando.
 * Respeita prefers-reduced-motion (não anima para quem pediu menos movimento).
 */
export function Confete({ gatilho, duracao = 1800 }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (gatilho === 0) return;
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const l = window.innerWidth;
    const a = window.innerHeight;
    canvas.width = l * dpr;
    canvas.height = a * dpr;
    ctx.scale(dpr, dpr);

    const particulas: Particula[] = Array.from({ length: 60 }, () => ({
      x: l * (0.15 + Math.random() * 0.7),
      y: -20 - Math.random() * a * 0.3,
      vx: (Math.random() - 0.5) * 2.4,
      vy: 2 + Math.random() * 3.4,
      giro: Math.random() * Math.PI,
      vgiro: (Math.random() - 0.5) * 0.28,
      lado: 8 + Math.random() * 10,
      cor: CORES[Math.floor(Math.random() * CORES.length)],
    }));

    let quadro = 0;
    const inicio = performance.now();

    const desenhar = (agora: number) => {
      const t = agora - inicio;
      ctx.clearRect(0, 0, l, a);

      for (const p of particulas) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.045; // gravidade
        p.giro += p.vgiro;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.giro);
        ctx.fillStyle = p.cor;
        ctx.globalAlpha = Math.max(0, 1 - t / duracao);
        ctx.fillRect(-p.lado / 2, -p.lado / 4, p.lado, p.lado / 2);
        ctx.restore();
      }

      if (t < duracao) quadro = requestAnimationFrame(desenhar);
      else ctx.clearRect(0, 0, l, a);
    };

    quadro = requestAnimationFrame(desenhar);
    return () => cancelAnimationFrame(quadro);
  }, [gatilho, duracao]);

  return (
    <canvas
      ref={ref}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[60] h-full w-full"
    />
  );
}
