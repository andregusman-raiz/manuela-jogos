"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { feedback, tocar } from "@/lib/som";

type Props = {
  children: ReactNode;
  onConfirmar: () => void;
  rotulo: string;
  /** Tempo de pressão em ms. 2s para apagar; 3s no portão parental. */
  duracao?: number;
  className?: string;
};

/**
 * Confirmação por PRESSÃO, no lugar de diálogo "tem certeza?".
 *
 * Criança de 6 anos não lê a caixa de confirmação — mas entende segurando o
 * dedo e vendo o anel encher. É assim que nenhuma ação destrutiva acontece em
 * um toque só, sem depender de texto.
 */
export function BotaoSegurar({
  children,
  onConfirmar,
  rotulo,
  duracao = 2000,
  className = "",
}: Props) {
  const [progresso, setProgresso] = useState(0);
  const quadro = useRef<number | null>(null);
  const inicio = useRef(0);

  const parar = useCallback(() => {
    if (quadro.current !== null) cancelAnimationFrame(quadro.current);
    quadro.current = null;
    setProgresso(0);
  }, []);

  useEffect(() => parar, [parar]);

  const comecar = () => {
    feedback("toque");
    inicio.current = performance.now();

    const passo = (agora: number) => {
      const p = Math.min(1, (agora - inicio.current) / duracao);
      setProgresso(p);
      if (p >= 1) {
        parar();
        onConfirmar();
        return;
      }
      quadro.current = requestAnimationFrame(passo);
    };
    quadro.current = requestAnimationFrame(passo);
  };

  // Anel de progresso: raio 34 -> circunferência ~213.6
  const circunferencia = 2 * Math.PI * 34;

  return (
    <button
      type="button"
      aria-label={rotulo}
      onPointerDown={comecar}
      onPointerUp={() => {
        if (progresso > 0 && progresso < 1) tocar("desfazer");
        parar();
      }}
      onPointerLeave={parar}
      onPointerCancel={parar}
      onContextMenu={(e) => e.preventDefault()}
      className={`bolha relative bg-manu-papel/90 text-4xl ring-2 ring-manu-cacau/10 ${className}`}
    >
      <span className="relative z-10">{children}</span>
      <svg
        viewBox="0 0 80 80"
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full -rotate-90"
      >
        <circle
          cx="40"
          cy="40"
          r="34"
          fill="none"
          stroke="currentColor"
          strokeWidth="6"
          strokeLinecap="round"
          className="text-manu-rosa-forte"
          strokeDasharray={circunferencia}
          strokeDashoffset={circunferencia * (1 - progresso)}
          opacity={progresso > 0 ? 1 : 0}
        />
      </svg>
    </button>
  );
}
