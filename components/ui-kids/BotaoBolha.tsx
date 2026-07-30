"use client";

import type { ReactNode } from "react";
import { feedback, type Efeito } from "@/lib/som";

type Props = {
  children: ReactNode;
  onClick?: () => void;
  /** Rótulo lido por leitor de tela — a criança se orienta pelo ícone. */
  rotulo: string;
  ativo?: boolean;
  efeito?: Efeito;
  /** xl = ação principal (88px). md = padrão (72px, piso da NN/g). */
  tamanho?: "md" | "xl";
  className?: string;
  desabilitado?: boolean;
};

/**
 * Botão-bolha: o único botão do app.
 *
 * Alvo grande (>=72px, ~2cm), afunda ao toque, e responde com som + vibração.
 * Nenhum botão do app é destrutivo em um toque — para isso existe o
 * BotaoSegurar.
 */
export function BotaoBolha({
  children,
  onClick,
  rotulo,
  ativo = false,
  efeito = "toque",
  tamanho = "md",
  className = "",
  desabilitado = false,
}: Props) {
  return (
    <button
      type="button"
      aria-label={rotulo}
      aria-pressed={ativo}
      disabled={desabilitado}
      onPointerDown={() => {
        if (!desabilitado) feedback(efeito);
      }}
      onClick={() => {
        if (!desabilitado) onClick?.();
      }}
      className={`bolha ${tamanho === "xl" ? "min-h-toque-xl min-w-toque-xl" : ""} ${
        ativo
          ? "bg-manu-papel ring-4 ring-manu-rosa-forte"
          : "bg-manu-papel/90 ring-2 ring-manu-cacau/10"
      } ${desabilitado ? "opacity-40" : ""} text-4xl ${className}`}
    >
      {children}
    </button>
  );
}
