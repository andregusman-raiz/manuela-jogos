"use client";

import Image from "next/image";
import { useState } from "react";
import { NovoJogador } from "@/components/hub/NovoJogador";
import { MAXIMO_DINAMICOS, PERFIS, salvarJogador, type Perfil } from "@/lib/perfis";
import { usePerfis } from "@/lib/usePerfil";
import { feedback, tocar } from "@/lib/som";

/**
 * "Quem vai jogar?" — a porta de entrada do app. Um card grande por perfil
 * (hoje só a Manuela); tocar escolhe e revela o hub. Novos perfis aparecem
 * aqui sozinhos quando entrarem em lib/perfis.ts.
 */
export function EscolhaJogador() {
  const perfis = usePerfis();
  const [assistente, setAssistente] = useState<{ aberto: boolean; editando: Perfil | null }>({
    aberto: false,
    editando: null,
  });
  const podeCriar = perfis.length - PERFIS.length < MAXIMO_DINAMICOS;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="escolher quem vai jogar"
      data-escolha-jogador="true"
      className="fixed inset-0 z-30 flex flex-col items-center gap-4 bg-manu-nuvem px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))]"
    >
      <h1 className="shrink-0 text-center font-titulo text-3xl text-manu-cacau">Quem vai jogar?</h1>
      <div className="flex min-h-0 flex-1 flex-wrap [align-content:safe_center] items-stretch justify-center gap-4 overflow-y-auto py-2">
        {perfis.map((perfil) => {
          const escala = 150 / Math.max(perfil.corpo.largura, perfil.corpo.altura);
          return (
            <div key={perfil.id} className="relative">
            {perfil.dinamico ? (
              <button
                type="button"
                aria-label={`gerenciar ${perfil.identidade.nome}`}
                data-gerenciar={perfil.id}
                onClick={() => {
                  feedback("toque");
                  setAssistente({ aberto: true, editando: perfil });
                }}
                className="bolha absolute -right-2 -top-2 z-10 min-h-11 min-w-11 bg-manu-papel text-base ring-2 ring-manu-cacau/20"
              >
                ✎
              </button>
            ) : null}
            <button
              type="button"
              autoFocus={perfil.id === perfis[0].id}
              aria-label={`jogar como ${perfil.identidade.nome}`}
              data-perfil={perfil.id}
              onClick={() => {
                feedback("abrir");
                tocar("vitoria");
                salvarJogador(perfil.id);
              }}
              className={`bolha flex min-h-56 min-w-44 shrink-0 flex-col items-center justify-end gap-2 bg-manu-papel p-4 ring-4 transition-transform active:scale-[0.97] sm:min-h-64 sm:min-w-52 ${perfil.anel}`}
            >
              <Image
                src={perfil.corpo.src}
                alt=""
                width={Math.round(perfil.corpo.largura * escala)}
                height={Math.round(perfil.corpo.altura * escala)}
                priority
                draggable={false}
                className="anima-pulinho h-36 w-auto select-none object-contain drop-shadow-md sm:h-44"
              />
              <span className="font-titulo text-2xl text-manu-cacau">
                {perfil.identidade.nome}
              </span>
            </button>
            </div>
          );
        })}
        {podeCriar ? (
          <button
            type="button"
            aria-label="criar novo jogador"
            data-criar-jogador="true"
            onClick={() => {
              feedback("abrir");
              setAssistente({ aberto: true, editando: null });
            }}
            className="flex min-h-56 min-w-44 shrink-0 flex-col items-center justify-center gap-3 rounded-[2rem] border-4 border-dashed border-manu-cacau/25 bg-manu-papel/40 font-titulo text-manu-cacau-suave sm:min-h-64 sm:min-w-52"
          >
            <span aria-hidden className="text-5xl">＋</span>
            Novo jogador
          </button>
        ) : null}
      </div>
      <p className="shrink-0 text-center text-xs text-manu-cacau-suave">
        Toque na figura para começar
      </p>
      <NovoJogador
        key={assistente.aberto ? (assistente.editando?.id ?? "novo") : "fechado"}
        aberto={assistente.aberto}
        editando={assistente.editando}
        onFechar={() => setAssistente({ aberto: false, editando: null })}
      />
    </div>
  );
}
