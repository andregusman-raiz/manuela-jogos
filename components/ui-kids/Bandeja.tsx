"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";

type Props = {
  aberta: boolean;
  onFechar: () => void;
  children: ReactNode;
  /** Título curto (reforço para quem lê; a criança usa os ícones). */
  titulo?: string;
};

/**
 * Bandeja que sobe de baixo com as variações da ferramenta ativa.
 *
 * Fica na metade inferior (alcance do polegar) e fecha tocando em qualquer
 * lugar fora — sem "x" pequeno para acertar.
 */
export function Bandeja({ aberta, onFechar, children, titulo }: Props) {
  useEffect(() => {
    if (!aberta) return;
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") onFechar();
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [aberta, onFechar]);

  if (!aberta) return null;

  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end">
      <button
        type="button"
        aria-label="Fechar"
        onClick={onFechar}
        className="flex-1 cursor-default bg-manu-cacau/20"
      />
      <div
        role="dialog"
        aria-label={titulo ?? "Opções"}
        className="anima-bandeja rounded-t-[2rem] bg-manu-papel px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-6px_24px_rgba(46,20,8,0.15)]"
      >
        <div className="mx-auto mb-3 h-1.5 w-16 rounded-full bg-manu-cacau/15" />
        {titulo ? (
          <h2 className="mb-2 text-center text-lg text-manu-cacau-suave">{titulo}</h2>
        ) : null}
        <div className="flex flex-wrap items-center justify-center gap-3">{children}</div>
      </div>
    </div>
  );
}
