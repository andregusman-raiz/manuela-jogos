"use client";

import { saudacao } from "@/lib/identidade";
import { useIdentidade } from "@/lib/usePerfil";

/** Saudação + título do hub seguindo o jogador escolhido. */
export function SaudacaoHub() {
  const identidade = useIdentidade();
  return (
    <div className="pb-2">
      <p className="font-titulo text-lg text-manu-rosa-texto">{saudacao(identidade)}</p>
      <h1 className="font-titulo text-4xl leading-none text-manu-cacau">
        {identidade.nome}
        <br />
        Jogos
      </h1>
    </div>
  );
}
