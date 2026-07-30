"use client";

import Link from "next/link";
import { feedback } from "@/lib/som";
import type { Jogo } from "@/lib/jogos";

/**
 * Card de jogo do hub. Alvo enorme (a criança acerta de longe), emoji literal e
 * cor própria — dá para escolher o jogo sem ler nada.
 *
 * Jogo indisponível não vira cadeado frustrante: fica com cara de presente
 * embrulhado e não navega para lugar nenhum.
 */
export function CardJogo({ jogo }: { jogo: Jogo }) {
  const conteudo = (
    <>
      <span aria-hidden className="text-7xl drop-shadow-sm">
        {jogo.emoji}
      </span>
      <span className="font-titulo text-2xl leading-tight text-manu-cacau">{jogo.nome}</span>
      <span className="text-sm text-manu-cacau-suave">{jogo.descricao}</span>
    </>
  );

  const classes = `flex min-h-52 flex-col items-center justify-center gap-2 rounded-[2rem] p-5 text-center shadow-[0_5px_0_0_rgba(0,0,0,0.12)] transition-transform active:translate-y-1 active:scale-[0.98] ${jogo.cor}`;

  if (!jogo.disponivel) {
    return (
      <div aria-label={`${jogo.nome} — em breve`} className={`${classes} opacity-70`}>
        {conteudo}
      </div>
    );
  }

  return (
    <Link
      href={jogo.rota}
      aria-label={jogo.nome}
      onPointerDown={() => feedback("abrir")}
      className={classes}
    >
      {conteudo}
    </Link>
  );
}
