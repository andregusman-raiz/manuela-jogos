"use client";

import Image from "next/image";
import { PERFIS, salvarJogador } from "@/lib/perfis";
import { feedback, tocar } from "@/lib/som";

/**
 * "Quem vai jogar?" — a porta de entrada do app. Um card grande por perfil
 * (hoje só a Manuela); tocar escolhe e revela o hub. Novos perfis aparecem
 * aqui sozinhos quando entrarem em lib/perfis.ts.
 */
export function EscolhaJogador() {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="escolher quem vai jogar"
      data-escolha-jogador="true"
      className="fixed inset-0 z-30 flex flex-col items-center justify-center gap-6 bg-manu-nuvem px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))]"
    >
      <h1 className="text-center font-titulo text-3xl text-manu-cacau">Quem vai jogar?</h1>
      <div className="flex flex-wrap items-stretch justify-center gap-4">
        {PERFIS.map((perfil) => {
          const escala = 180 / Math.max(perfil.figura.largura, perfil.figura.altura);
          return (
            <button
              key={perfil.id}
              type="button"
              aria-label={`jogar como ${perfil.identidade.nome}`}
              data-perfil={perfil.id}
              onClick={() => {
                feedback("abrir");
                tocar("vitoria");
                salvarJogador(perfil.id);
              }}
              className="bolha flex min-h-64 min-w-52 flex-col items-center justify-end gap-3 bg-manu-papel p-5 ring-4 ring-manu-rosa transition-transform active:scale-[0.97]"
            >
              <Image
                src={perfil.figura.src}
                alt=""
                width={Math.round(perfil.figura.largura * escala)}
                height={Math.round(perfil.figura.altura * escala)}
                priority
                draggable={false}
                className="anima-pulinho h-44 w-auto select-none object-contain drop-shadow-md"
              />
              <span className="font-titulo text-2xl text-manu-cacau">
                {perfil.identidade.nome}
              </span>
            </button>
          );
        })}
      </div>
      <p className="text-center text-xs text-manu-cacau-suave">
        Toque na figura para começar
      </p>
    </div>
  );
}
