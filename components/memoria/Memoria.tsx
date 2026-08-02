"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { BotaoBolha } from "@/components/ui-kids/BotaoBolha";
import { Confete } from "@/components/ui-kids/Confete";
import { Icone } from "@/components/ui-kids/Icone";
import { Mascote } from "@/components/ui-kids/Mascote";
import { lerProgresso, salvarProgresso } from "@/lib/armazenamento";
import {
  NIVEL_MAXIMO_MEMORIA,
  criarRng,
  criarTabuleiro,
  fecharCartas,
  proximoNivelMemoria,
  tocarCarta,
} from "@/lib/memoria/motor";
import type { EstadoTabuleiro, NivelMemoria } from "@/lib/memoria/tipos";
import { assinarMudo, definirMudo, estaMudo, feedback, mudoNoServidor, tocar } from "@/lib/som";

/**
 * Jogo da Memória — pares por `parId` explícito, tabuleiro travado durante a
 * janela de 900ms (toques ignorados NO MOTOR, não na UI). Nível 3 é a ponte
 * com a matemática: carta de conta casa com carta de resultado.
 */
export function Memoria() {
  const [estado, setEstado] = useState<EstadoTabuleiro | null>(null);
  const rng = useRef<(() => number) | null>(null);
  const mudo = useSyncExternalStore(assinarMudo, estaMudo, mudoNoServidor);

  useEffect(() => {
    rng.current = criarRng(Date.now() % 2147483647);
    void lerProgresso("memoria").then((p) => {
      const nivel = Math.min(p?.nivel ?? 1, NIVEL_MAXIMO_MEMORIA) as NivelMemoria;
      setEstado(criarTabuleiro(nivel, rng.current!));
    });
  }, []);

  const fase = estado?.fase;
  const paresAchados = estado ? estado.removidas.length / 2 : 0;

  // Os 900ms são um EVENTO: o motor só fecha quando ele chega; toque no meio
  // é no-op por construção. O som de virar de volta acompanha o fechamento.
  useEffect(() => {
    if (fase !== "resolvendo") return;
    const t = setTimeout(() => {
      tocar("passo");
      setEstado((atual) => (atual ? fecharCartas(atual) : atual));
    }, 900);
    return () => clearTimeout(t);
  }, [fase]);

  // Sons seguem a transição real: par achado → acerto; tabuleiro completo →
  // vitória + persistência (nível liberado e recorde de tentativas).
  useEffect(() => {
    if (!estado || paresAchados === 0) return;
    if (estado.fase === "completa") {
      tocar("vitoria");
      void salvarProgresso("memoria", proximoNivelMemoria(estado.nivel), estado.tentativas);
    } else {
      tocar("acerto");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paresAchados]);

  function aoTocar(id: number) {
    setEstado((atual) => (atual ? tocarCarta(atual, id) : atual));
  }

  function jogarDeNovo() {
    if (!estado || !rng.current) return;
    setEstado(criarTabuleiro(estado.nivel, rng.current));
  }

  function maisDificil() {
    if (!estado || !rng.current) return;
    setEstado(criarTabuleiro(proximoNivelMemoria(estado.nivel), rng.current));
  }

  // deitado: mais colunas e menos linhas — 4 linhas de cartas quadradas não
  // cabem em ~290px de altura e sobrepunham (QAT 2026-07-31)
  const colunas =
    estado?.nivel === 2
      ? "grid-cols-4 deitado:grid-cols-8"
      : "grid-cols-3 deitado:grid-cols-6";

  return (
    <main data-nivel={estado?.nivel ?? 0} className="flex h-[100dvh] flex-col overflow-hidden">
      <header className="flex h-16 shrink-0 items-center gap-2 px-2 pt-[env(safe-area-inset-top)] deitado:h-12">
        <Link
          href="/"
          aria-label="voltar para os jogos"
          onPointerDown={() => feedback("toque")}
          className="bolha h-14 min-h-14 w-14 min-w-14 overflow-hidden bg-manu-rosa/40 ring-2 ring-manu-rosa"
        >
          <Mascote pose="rosto" tamanho={56} className="h-14 w-14 object-cover" />
        </Link>
        <h1 className="hidden font-titulo text-xl text-manu-cacau sm:block">Jogo da Memória</h1>
        {estado ? (
          <span className="rounded-full bg-manu-sol px-3 py-1 font-titulo text-sm text-manu-cacau">
            Nível {estado.nivel}
          </span>
        ) : null}
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

      {estado ? (
        <div
          aria-label={`${estado.tentativas} tentativas`}
          data-tentativas={estado.tentativas}
          className="shrink-0 py-1 text-center font-titulo text-sm text-manu-cacau-suave"
        >
          {estado.tentativas === 0
            ? "Encontre os pares!"
            : estado.tentativas === 1
              ? "1 tentativa"
              : `${estado.tentativas} tentativas`}
        </div>
      ) : null}

      <div className="relative min-h-0 flex-1 px-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {estado && estado.fase !== "completa" ? (
          <div
            className={`grid h-full ${colunas} content-center justify-center gap-2`}
            // gotcha do repo: aspect-ratio em grid sem auto-rows explícita
            // colapsa as linhas (~18px)
            style={{ gridAutoRows: "minmax(72px, auto)" }}
          >
            {estado.cartas.map((carta) => {
              const removida = estado.removidas.includes(carta.id);
              const aberta = estado.abertas.includes(carta.id);
              if (removida) {
                return <div key={carta.id} aria-hidden className="min-h-toque" />;
              }
              return (
                <button
                  key={carta.id}
                  type="button"
                  aria-label={aberta ? carta.face : `carta ${carta.id + 1}`}
                  data-par={carta.parId}
                  data-estado={aberta ? "aberta" : "fechada"}
                  onPointerDown={() => feedback("toque")}
                  onClick={() => aoTocar(carta.id)}
                  className={`bolha mx-auto aspect-square w-full max-w-28 select-none transition-transform ${
                    aberta
                      ? carta.tipo === "conta"
                        ? "bg-manu-ceu-claro ring-2 ring-manu-ceu"
                        : "bg-manu-papel ring-2 ring-manu-cacau/20"
                      : "bg-manu-sol/70 ring-2 ring-manu-sol-forte"
                  }`}
                >
                  <span
                    // flip pontual da SPEC §4.2: a face entra animada UMA vez
                    // ao abrir (anima-entrada); nada de loop infinito
                    key={aberta ? "face" : "costas"}
                    className={`${aberta ? "anima-entrada" : ""} ${
                      carta.tipo === "emoji" ? "text-4xl" : "font-titulo text-2xl"
                    }`}
                  >
                    {aberta ? carta.face : "❓"}
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}

        {estado?.fase === "completa" ? (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-manu-nuvem/95 px-4">
            <Mascote pose="comemorando" tamanho={150} className="h-36 w-auto drop-shadow-md" />
            <p className="text-center font-titulo text-3xl text-manu-cacau">Você achou todos!</p>
            <p className="font-titulo text-lg text-manu-cacau-suave">
              Em {estado.tentativas} tentativas
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <BotaoBolha rotulo="jogar de novo" tamanho="xl" onClick={jogarDeNovo}>
                <span className="px-3 font-titulo text-2xl">De novo</span>
              </BotaoBolha>
              {estado.nivel < NIVEL_MAXIMO_MEMORIA ? (
                <BotaoBolha
                  rotulo="mais difícil"
                  tamanho="xl"
                  efeito="abrir"
                  onClick={maisDificil}
                  className="bg-manu-sol"
                >
                  <span className="px-3 font-titulo text-2xl">Mais difícil</span>
                </BotaoBolha>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      <Confete gatilho={paresAchados} duracao={estado?.fase === "completa" ? 1800 : 700} />
    </main>
  );
}
