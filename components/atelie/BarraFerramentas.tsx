"use client";

import { useSyncExternalStore } from "react";
import { feedback } from "@/lib/som";
import { TODOS_PINCEIS } from "@/lib/desenho/ferramentas";
import type { Ferramenta } from "@/lib/desenho/ferramentas";
import { Icone } from "@/components/ui-kids/Icone";
import {
  assinarDescoberta,
  descobertaNoServidor,
  jaDescobriuMais,
} from "@/lib/descoberta";

type Props = {
  ferramenta: Ferramenta;
  podeDesfazer: boolean;
  aoTrocarModo: (modo: Ferramenta["modo"]) => void;
  aoUsarBorracha: () => void;
  aoAbrirPinceis: () => void;
  aoAbrirMais: () => void;
  aoDesfazer: () => void;
};

/**
 * Barra de ferramentas — mora na metade de baixo da tela, no alcance do polegar.
 *
 * Cinco alvos por linha: em celular de 360px cada um fica com ~66px, e em tela
 * maior cresce até 92px. Tocar de novo na ferramenta ATIVA abre a bandeja com as
 * variações dela (é assim que caibam 8 pincéis sem poluir a barra).
 */
export function BarraFerramentas({
  ferramenta,
  podeDesfazer,
  aoTrocarModo,
  aoUsarBorracha,
  aoAbrirPinceis,
  aoAbrirMais,
  aoDesfazer,
}: Props) {
  const pincelAtual = TODOS_PINCEIS.find((p) => p.tipo === ferramenta.pincel) ?? TODOS_PINCEIS[1];
  const descobriuMais = useSyncExternalStore(
    assinarDescoberta,
    jaDescobriuMais,
    descobertaNoServidor,
  );
  const desenhando = ferramenta.modo === "pincel" && ferramenta.pincel !== "borracha";
  const apagando = ferramenta.modo === "pincel" && ferramenta.pincel === "borracha";

  const base =
    "bolha aspect-square w-full min-w-0 max-w-[92px] text-3xl transition-transform justify-self-center";
  const ativo = "bg-manu-papel ring-4 ring-manu-rosa-forte";
  const inativo = "bg-manu-papel/85 ring-2 ring-manu-cacau/10";

  return (
    <nav
      aria-label="Ferramentas"
      className="grid grid-cols-5 items-center gap-2 bg-manu-nuvem px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1"
    >
      {/* pincel: um toque escolhe, outro toque abre as variações */}
      <button
        type="button"
        aria-label={`pincel: ${pincelAtual.nome}`}
        aria-pressed={desenhando}
        onPointerDown={() => feedback("pincel")}
        onClick={() => (desenhando ? aoAbrirPinceis() : aoTrocarModo("pincel"))}
        className={`${base} ${desenhando ? ativo : inativo}`}
      >
        <span className="relative">
          {pincelAtual.emoji}
          <span
            aria-hidden
            className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full ring-2 ring-manu-papel"
            style={{ backgroundColor: ferramenta.cor }}
          />
        </span>
      </button>

      <button
        type="button"
        aria-label="borracha"
        aria-pressed={apagando}
        onPointerDown={() => feedback("pincel")}
        onClick={aoUsarBorracha}
        className={`${base} ${apagando ? ativo : inativo}`}
      >
        <Icone nome="borracha" tamanho={38} />
      </button>

      <button
        type="button"
        aria-label="balde de tinta"
        aria-pressed={ferramenta.modo === "balde"}
        onPointerDown={() => feedback("balde")}
        onClick={() => aoTrocarModo("balde")}
        className={`${base} ${ferramenta.modo === "balde" ? ativo : inativo}`}
      >
        <Icone nome="balde" tamanho={38} />
      </button>

      <button
        type="button"
        aria-label="mais coisas: carimbos, formas, espelho e fundo"
        onPointerDown={() => feedback("toque")}
        onClick={aoAbrirMais}
        className={`${base} ${
          ferramenta.modo === "carimbo" || ferramenta.modo === "forma" ? ativo : inativo
        } ${descobriuMais ? "" : "anima-chama"}`}
      >
        {ferramenta.modo === "carimbo" ? (
          ferramenta.carimbo
        ) : ferramenta.modo === "forma" ? (
          "⭕"
        ) : (
          <Icone nome="varinha" tamanho={38} />
        )}
      </button>

      <button
        type="button"
        aria-label="desfazer"
        disabled={!podeDesfazer}
        onPointerDown={() => podeDesfazer && feedback("desfazer")}
        onClick={aoDesfazer}
        className={`${base} bg-manu-sol ring-2 ring-manu-sol-forte ${
          podeDesfazer ? "" : "opacity-35"
        }`}
      >
        <Icone nome="desfazer" tamanho={38} />
      </button>
    </nav>
  );
}
