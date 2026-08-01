"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { BotaoBolha } from "@/components/ui-kids/BotaoBolha";
import { Confete } from "@/components/ui-kids/Confete";
import { Icone } from "@/components/ui-kids/Icone";
import { Manu } from "@/components/ui-kids/Manu";
import { salvarProgresso } from "@/lib/armazenamento";
import { criarPartida, iaEscolher, semear } from "@/lib/mancala/motor";
import type { EstadoMancala, LadoMancala } from "@/lib/mancala/motor";
import { assinarMudo, definirMudo, estaMudo, feedback, mudoNoServidor, tocar } from "@/lib/som";

type ModoMancala = "2p" | "manu";

const NOMES = ["Rosa", "Azul"] as const;

/** Bolinhas de semente (até 6 visíveis; acima disso o número fala sozinho). */
function Sementes({ n }: { n: number }) {
  return (
    <span className="pointer-events-none absolute inset-1 flex flex-wrap content-end items-end justify-center gap-0.5 opacity-60">
      {Array.from({ length: Math.min(n, 6) }, (_, i) => (
        <span key={i} className="h-1.5 w-1.5 rounded-full bg-manu-cacau/50" />
      ))}
    </span>
  );
}

export function Mancala() {
  const [modo, setModo] = useState<ModoMancala | null>(null);
  const [estado, setEstado] = useState<EstadoMancala | null>(null);
  const mudo = useSyncExternalStore(assinarMudo, estaMudo, mudoNoServidor);

  const situacao = estado?.situacao;

  // vez da Manu (greedy determinística — sem rng)
  useEffect(() => {
    if (!estado || modo !== "manu" || estado.situacao !== "jogando" || estado.vez !== 1) return;
    const t = setTimeout(() => {
      tocar("toque");
      setEstado(semear(estado, iaEscolher(estado)));
    }, 700);
    return () => clearTimeout(t);
  }, [estado, modo]);

  useEffect(() => {
    if (!estado || situacao !== "fim") return;
    const humanoPerdeu = modo === "manu" && estado.vencedor === 1;
    tocar(estado.vencedor === null ? "passo" : humanoPerdeu ? "erro" : "vitoria");
    void salvarProgresso("mancala", 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [situacao]);

  function comecar(escolhido: ModoMancala) {
    feedback("abrir");
    setModo(escolhido);
    setEstado(criarPartida());
  }

  function aoTocarCova(lado: LadoMancala, cova: number) {
    if (!estado || estado.situacao !== "jogando") return;
    if (lado !== estado.vez) return;
    if (modo === "manu" && estado.vez !== 0) return;
    const proximo = semear(estado, cova);
    if (proximo === estado) return;
    const ganho = proximo.kalahs[estado.vez] - estado.kalahs[estado.vez];
    const extra = proximo.situacao === "jogando" && proximo.vez === estado.vez;
    tocar(ganho >= 2 ? "acerto" : extra ? "cor" : "toque");
    setEstado(proximo);
  }

  const confete =
    situacao === "fim" && estado?.vencedor !== null && !(modo === "manu" && estado?.vencedor === 1);

  /** Cova como botão grande; `lado` topo (1) é desenhado da direita p/ esquerda. */
  function Cova({ lado, indice }: { lado: LadoMancala; indice: number }) {
    if (!estado) return null;
    const sementes = estado.covas[lado][indice];
    const minhaVez =
      estado.situacao === "jogando" &&
      lado === estado.vez &&
      !(modo === "manu" && lado === 1) &&
      sementes > 0;
    return (
      <button
        type="button"
        aria-label={`cova ${indice + 1} do ${NOMES[lado]} com ${sementes} sementes`}
        data-cova={`${lado}-${indice}`}
        data-sementes={sementes}
        disabled={!minhaVez}
        onPointerDown={() => {
          if (minhaVez) feedback("toque");
        }}
        onClick={() => aoTocarCova(lado, indice)}
        className={`relative flex aspect-square min-h-11 w-full items-center justify-center rounded-full font-titulo text-xl text-manu-cacau shadow-[inset_0_3px_6px_rgba(0,0,0,0.12)] ${
          lado === 0 ? "bg-manu-rosa/40" : "bg-manu-ceu/40"
        } ${minhaVez ? "ring-2 ring-manu-sol-forte" : "opacity-90"}`}
      >
        {sementes}
        <Sementes n={sementes} />
      </button>
    );
  }

  return (
    <main data-modo={modo ?? ""} className="flex h-[100dvh] flex-col overflow-hidden">
      <header className="flex h-16 shrink-0 items-center gap-2 px-2 pt-[env(safe-area-inset-top)] deitado:h-12">
        <Link
          href="/"
          aria-label="voltar para os jogos"
          onPointerDown={() => feedback("toque")}
          className="bolha h-14 min-h-14 w-14 min-w-14 overflow-hidden bg-manu-rosa/40 ring-2 ring-manu-rosa"
        >
          <Manu pose="rosto" tamanho={56} className="h-14 w-14 object-cover" />
        </Link>
        <h1 className="hidden font-titulo text-xl text-manu-cacau sm:block">Mancala</h1>
        <div className="ml-auto">
          <button
            type="button"
            aria-label={mudo ? "ligar o som" : "desligar o som"}
            onClick={() => {
              definirMudo(!mudo);
              if (mudo) tocar("toque");
            }}
            className="bolha min-h-14 min-w-14 bg-manu-papel ring-2 ring-manu-cacau/10"
          >
            <Icone nome={mudo ? "mudo" : "som"} tamanho={30} />
          </button>
        </div>
      </header>

      {!estado ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-5 px-4">
          <Manu pose="corpo" tamanho={140} className="h-32 w-auto drop-shadow-md" />
          <p className="text-center font-titulo text-2xl text-manu-cacau">Jogar com quem?</p>
          <div className="flex flex-wrap justify-center gap-4">
            <BotaoBolha rotulo="jogar com alguém" tamanho="xl" onClick={() => comecar("2p")}>
              <span className="px-3 font-titulo text-xl">Com alguém</span>
            </BotaoBolha>
            <BotaoBolha
              rotulo="jogar com a Manu"
              tamanho="xl"
              efeito="abrir"
              onClick={() => comecar("manu")}
              className="bg-manu-sol"
            >
              <span className="px-3 font-titulo text-xl">Com a Manu</span>
            </BotaoBolha>
          </div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div
            data-vez={estado.vez}
            data-situacao={estado.situacao}
            className={`shrink-0 rounded-full px-3 py-1 font-titulo text-sm text-manu-cacau ${
              estado.vez === 0 ? "bg-manu-rosa/60" : "bg-manu-ceu/60"
            }`}
          >
            {estado.situacao === "jogando"
              ? modo === "manu"
                ? estado.vez === 0
                  ? "Sua vez! Toque numa cova rosa"
                  : "Manu pensando…"
                : `Vez: ${NOMES[estado.vez]}`
              : "Fim!"}
          </div>

          <div className="grid w-full max-w-[560px] grid-cols-[0.7fr_repeat(6,minmax(0,1fr))_0.7fr] items-center gap-1 rounded-3xl bg-manu-papel p-2 ring-2 ring-manu-cacau/10 sm:gap-2">
            {/* kalah do Azul (lado 1) na ponta esquerda */}
            <div
              data-kalah="1"
              data-sementes={estado.kalahs[1]}
              className="row-span-2 flex h-full min-h-24 flex-col items-center justify-center rounded-2xl bg-manu-ceu/50 font-titulo text-2xl text-manu-cacau"
            >
              {estado.kalahs[1]}
            </div>
            {/* linha de cima: covas do Azul, da direita para a esquerda */}
            {[5, 4, 3, 2, 1, 0].map((i) => (
              <Cova key={`b-${i}`} lado={1} indice={i} />
            ))}
            {/* kalah do Rosa (lado 0) na ponta direita */}
            <div
              data-kalah="0"
              data-sementes={estado.kalahs[0]}
              className="row-span-2 flex h-full min-h-24 flex-col items-center justify-center rounded-2xl bg-manu-rosa/50 font-titulo text-2xl text-manu-cacau"
            >
              {estado.kalahs[0]}
            </div>
            {/* linha de baixo: covas do Rosa, da esquerda para a direita */}
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Cova key={`a-${i}`} lado={0} indice={i} />
            ))}
          </div>
          <p className="shrink-0 text-center font-titulo text-xs text-manu-cacau-suave">
            Semeie e colha: quem guarda mais sementes vence!
          </p>
        </div>
      )}

      {estado?.situacao === "fim" ? (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-manu-nuvem/95 px-4">
          <Manu
            pose={modo === "manu" && estado.vencedor === 1 ? "rosto" : "comemorando"}
            tamanho={150}
            className="h-36 w-auto drop-shadow-md"
          />
          <p className="text-center font-titulo text-3xl text-manu-cacau">
            {estado.vencedor === null
              ? "Empatou! 24 a 24"
              : modo === "manu"
                ? estado.vencedor === 0
                  ? `Você venceu! ${estado.kalahs[0]} a ${estado.kalahs[1]}`
                  : `A Manu venceu, ${estado.kalahs[1]} a ${estado.kalahs[0]}`
                : `${NOMES[estado.vencedor]} venceu! ${estado.kalahs[estado.vencedor]} a ${estado.kalahs[1 - estado.vencedor]}`}
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <BotaoBolha
              rotulo="jogar de novo"
              tamanho="xl"
              onClick={() => {
                setEstado(null);
                setModo(null);
              }}
            >
              <span className="px-3 font-titulo text-2xl">De novo</span>
            </BotaoBolha>
          </div>
        </div>
      ) : null}

      <Confete gatilho={confete ? 1 : 0} duracao={1800} />
    </main>
  );
}
