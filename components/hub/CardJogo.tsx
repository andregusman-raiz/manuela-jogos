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
      <span aria-hidden className="text-3xl drop-shadow-sm sm:text-5xl">
        {jogo.emoji}
      </span>
      <span className="line-clamp-3 font-titulo text-xs leading-tight text-manu-cacau sm:text-sm">
        {jogo.nome}
      </span>
    </>
  );

  // Compacto no celular: com 5 jogos, TODOS os cards precisam caber na dobra —
  // criança não procura conteúdo escondido atrás de scroll.
  // max-h-56 + self-center: com POUCOS jogos visíveis (config), as linhas fr
  // ficam gigantes — o card trava em 224px centrado em vez de virar uma torre
  const classes = `flex h-full max-h-56 min-h-24 flex-col items-center justify-center gap-1 self-center rounded-[1.25rem] p-1.5 text-center shadow-[0_5px_0_0_rgba(0,0,0,0.12)] transition-transform active:translate-y-1 active:scale-[0.98] sm:min-h-36 sm:gap-2 sm:p-3 ${jogo.cor}`;

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
