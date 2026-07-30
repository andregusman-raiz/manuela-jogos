"use client";

import { CORES_EXTRAS, CORES_PRINCIPAIS } from "@/lib/cores";
import { feedback } from "@/lib/som";

type Props = {
  cor: string;
  aoEscolher: (hex: string) => void;
  aoAbrirExtras: () => void;
};

/**
 * Fita de cores.
 *
 * Bolinhas grandes em rolagem horizontal: a criança escolhe reconhecendo a cor.
 * A cor ativa cresce e ganha anel escuro — precisa dar para ver de relance qual
 * está na mão.
 */
export function BarraCores({ cor, aoEscolher, aoAbrirExtras }: Props) {
  return (
    <div className="flex items-center gap-2 bg-manu-nuvem/95 px-2 py-2">
      <div
        className="flex flex-1 items-center gap-2 overflow-x-auto pb-1"
        style={{ scrollbarWidth: "none" }}
      >
        {CORES_PRINCIPAIS.map((c) => {
          const ativa = c.hex.toLowerCase() === cor.toLowerCase();
          return (
            <button
              key={c.hex}
              type="button"
              aria-label={c.nome}
              aria-pressed={ativa}
              onPointerDown={() => feedback("cor")}
              onClick={() => aoEscolher(c.hex)}
              className={`shrink-0 rounded-full transition-transform ${
                ativa
                  ? "h-14 w-14 scale-105 ring-4 ring-manu-cacau"
                  : "h-12 w-12 ring-2 ring-manu-cacau/15"
              }`}
              style={{ backgroundColor: c.hex }}
            />
          );
        })}
      </div>

      <button
        type="button"
        aria-label="mais cores"
        onPointerDown={() => feedback("toque")}
        onClick={aoAbrirExtras}
        className="bolha h-14 min-h-14 w-14 min-w-14 shrink-0 bg-manu-papel text-2xl ring-2 ring-manu-cacau/10"
      >
        🌈
      </button>
    </div>
  );
}

/** Grade das cores extras, mostrada dentro da bandeja. */
export function GradeCoresExtras({
  cor,
  aoEscolher,
}: {
  cor: string;
  aoEscolher: (hex: string) => void;
}) {
  return (
    <div className="grid grid-cols-6 gap-3">
      {[...CORES_PRINCIPAIS, ...CORES_EXTRAS].map((c) => {
        const ativa = c.hex.toLowerCase() === cor.toLowerCase();
        return (
          <button
            key={`extra-${c.hex}`}
            type="button"
            aria-label={c.nome}
            aria-pressed={ativa}
            onPointerDown={() => feedback("cor")}
            onClick={() => aoEscolher(c.hex)}
            className={`h-14 w-14 rounded-full ${
              ativa ? "ring-4 ring-manu-cacau" : "ring-2 ring-manu-cacau/15"
            }`}
            style={{ backgroundColor: c.hex }}
          />
        );
      })}
    </div>
  );
}
