"use client";

import { useState } from "react";
import { CATEGORIAS } from "@/lib/colorir/tipos";
import type { CategoriaColorir } from "@/lib/colorir/tipos";
import { paginasDaCategoria } from "@/lib/colorir/paginas";
import { MiniaturaColorir } from "./LivroColorir";
import { feedback } from "@/lib/som";
import { Icone } from "@/components/ui-kids/Icone";

type Props = {
  aberto: boolean;
  slugAtual?: string;
  aoEscolher: (slug: string | undefined) => void;
  aoFechar: () => void;
};

/**
 * Escolha do desenho para colorir.
 *
 * As categorias são abas com emoji grande; os desenhos aparecem como miniatura
 * do próprio traço (não como texto), então dá para escolher sem ler.
 */
export function SeletorColorir({ aberto, slugAtual, aoEscolher, aoFechar }: Props) {
  const [categoria, setCategoria] = useState<CategoriaColorir>("animais");
  if (!aberto) return null;

  const paginas = paginasDaCategoria(categoria);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-manu-nuvem">
      <header className="flex items-center gap-2 px-3 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2">
        <button
          type="button"
          aria-label="voltar"
          onPointerDown={() => feedback("desfazer")}
          onClick={aoFechar}
          className="bolha min-h-14 min-w-14 bg-manu-papel ring-2 ring-manu-cacau/10"
        >
          <Icone nome="voltar" tamanho={28} />
        </button>
        <h2 className="font-titulo text-2xl text-manu-cacau">Escolha um desenho</h2>
      </header>

      <div className="flex gap-2 overflow-x-auto px-3 pb-2" style={{ scrollbarWidth: "none" }}>
        {CATEGORIAS.map((c) => (
          <button
            key={c.id}
            type="button"
            aria-label={c.nome}
            aria-pressed={categoria === c.id}
            onPointerDown={() => feedback("toque")}
            onClick={() => setCategoria(c.id)}
            className={`bolha min-h-16 shrink-0 gap-1 px-4 text-3xl ${
              categoria === c.id
                ? "bg-manu-papel ring-4 ring-manu-rosa-forte"
                : "bg-manu-papel/80 ring-2 ring-manu-cacau/10"
            }`}
          >
            <span>{c.emoji}</span>
          </button>
        ))}
      </div>

      <div className="grid flex-1 grid-cols-2 content-start gap-3 overflow-y-auto px-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:grid-cols-3">
        <button
          type="button"
          aria-label="papel em branco para desenhar livre"
          onPointerDown={() => feedback("abrir")}
          onClick={() => aoEscolher(undefined)}
          className={`flex aspect-square flex-col items-center justify-center gap-1 rounded-[1.5rem] bg-manu-papel p-2 shadow-[0_4px_0_0_rgba(0,0,0,0.1)] ${
            slugAtual ? "ring-2 ring-manu-cacau/10" : "ring-4 ring-manu-rosa-forte"
          }`}
        >
          <span aria-hidden className="text-5xl">
            📄
          </span>
          <span className="font-titulo text-sm text-manu-cacau-suave">papel em branco</span>
        </button>

        {paginas.map((p) => (
          <button
            key={p.slug}
            type="button"
            aria-label={p.nome}
            onPointerDown={() => feedback("abrir")}
            onClick={() => aoEscolher(p.slug)}
            className={`aspect-square rounded-[1.5rem] bg-manu-papel p-1 shadow-[0_4px_0_0_rgba(0,0,0,0.1)] ${
              slugAtual === p.slug ? "ring-4 ring-manu-rosa-forte" : "ring-2 ring-manu-cacau/10"
            }`}
          >
            <MiniaturaColorir pagina={p} />
          </button>
        ))}
      </div>
    </div>
  );
}
