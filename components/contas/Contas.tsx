"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { BotaoBolha } from "@/components/ui-kids/BotaoBolha";
import { Confete } from "@/components/ui-kids/Confete";
import { Icone } from "@/components/ui-kids/Icone";
import { Manu } from "@/components/ui-kids/Manu";
import { lerProgresso, salvarProgresso } from "@/lib/armazenamento";
import {
  ACERTOS_POR_FASE,
  NIVEL_MAXIMO,
  aplicar,
  criarJogo,
  criarRng,
  duracaoQueda,
  proximoNivel,
} from "@/lib/contas/motor";
import type { EstadoJogo, Evento, Nivel } from "@/lib/contas/tipos";
import { assinarMudo, definirMudo, estaMudo, feedback, mudoNoServidor, tocar } from "@/lib/som";

/**
 * Foguete das Contas — a conta desce num meteoro, a criança escolhe a resposta
 * entre 4 bolhas. Meteoro que chega embaixo só quica e volta mais devagar:
 * nunca existe "game over" (SPEC §4.1).
 *
 * A corrida toque×chegada é resolvida no MOTOR (transição atômica via setState
 * funcional); aqui só existem timers que despacham eventos — e evento fora de
 * hora é no-op por construção.
 */
export function Contas() {
  // Estado nasce no cliente (seed + IndexedDB): render de servidor mostra só o
  // céu vazio, sem risco de hydration mismatch por Math.random/Date.
  const [estado, setEstado] = useState<EstadoJogo | null>(null);
  const rng = useRef<(() => number) | null>(null);
  const meteoro = useRef<HTMLDivElement>(null);
  const [negada, setNegada] = useState<{ indice: number; chave: number } | null>(null);
  const mudo = useSyncExternalStore(assinarMudo, estaMudo, mudoNoServidor);

  useEffect(() => {
    rng.current = criarRng(Date.now() % 2147483647);
    void lerProgresso("contas").then((p) => {
      const nivel = (Math.min(p?.nivel ?? 1, NIVEL_MAXIMO) as Nivel) || 1;
      setEstado(criarJogo(nivel, rng.current!));
    });
  }, []);

  const despachar = useCallback((evento: Evento) => {
    setEstado((atual) => (atual && rng.current ? aplicar(atual, evento, rng.current) : atual));
  }, []);

  // Queda: animação escrita DIRETO no elemento (não é estado de render) — topo
  // sem transição, reflow, e então desliza até a base. O timeout é o evento
  // "chegou-base"; a animação é só visual.
  const fase = estado?.fase;
  const rodada = estado?.rodada;
  useEffect(() => {
    if (!estado || fase !== "caindo") return;
    const dur = duracaoQueda(estado.nivel, estado.reapresentada);
    const el = meteoro.current;
    if (el) {
      el.style.transitionProperty = "none";
      el.style.top = "-18%";
      void el.offsetHeight; // reflow: aplica o topo antes de animar
      el.style.transitionProperty = "top";
      el.style.transitionTimingFunction = "linear";
      el.style.transitionDuration = `${dur}s`;
      el.style.top = "72%";
    }
    const t = setTimeout(() => despachar("chegou-base"), dur * 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fase, rodada, despachar]);

  // Sons e avanço seguem a TRANSIÇÃO real (nunca o clique): uma fonte só.
  useEffect(() => {
    if (!estado) return;
    if (estado.fase === "resolvida") {
      tocar("acerto");
      const t = setTimeout(() => despachar("proxima"), 650);
      return () => clearTimeout(t);
    }
    if (estado.fase === "quicou") {
      tocar("erro");
      const t = setTimeout(() => despachar("proxima"), 650);
      return () => clearTimeout(t);
    }
    if (estado.fase === "fase-completa") {
      tocar("vitoria");
      void salvarProgresso("contas", estado.nivel);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fase]);

  function aoTocarResposta(opcao: number, indice: number) {
    if (!estado || estado.fase !== "caindo") return;
    if (opcao === estado.rodada.resposta) {
      despachar("toque-certo");
    } else {
      // erro: shake + som suave; o meteoro continua (a criança tenta de novo)
      tocar("erro");
      setNegada((atual) => ({ indice, chave: (atual?.chave ?? 0) + 1 }));
    }
  }

  function jogarDeNovo() {
    if (!estado || !rng.current) return;
    setEstado(criarJogo(estado.nivel, rng.current));
  }

  function maisDificil() {
    if (!estado || !rng.current) return;
    const nivel = proximoNivel(estado.nivel);
    void salvarProgresso("contas", nivel);
    setEstado(criarJogo(nivel, rng.current));
  }

  return (
    <main data-nivel={estado?.nivel ?? 0} className="flex h-[100dvh] flex-col overflow-hidden">
      <header className="flex h-16 shrink-0 items-center gap-2 px-2 pt-[env(safe-area-inset-top)] deitado:h-12">
        <Link
          href="/"
          aria-label="voltar para os jogos"
          onPointerDown={() => feedback("toque")}
          className="bolha h-14 min-h-14 w-14 min-w-14 overflow-hidden bg-manu-rosa/40 ring-2 ring-manu-rosa"
        >
          <Manu pose="rosto" tamanho={56} className="h-14 w-14 object-cover" />
        </Link>
        <h1 className="hidden font-titulo text-xl text-manu-cacau sm:block">Foguete das Contas</h1>
        {estado ? (
          <span className="rounded-full bg-manu-ceu px-3 py-1 font-titulo text-sm text-manu-cacau">
            Nível {estado.nivel}
          </span>
        ) : null}
        <div className="ml-auto">
          <button
            type="button"
            aria-label={mudo ? "ligar o som" : "desligar o som"}
            onClick={() => {
              definirMudo(!mudo);
              if (mudo) tocar("toque"); // acabou de LIGAR o som: confirma sonoramente
            }}
            className="bolha min-h-14 min-w-14 bg-manu-papel ring-2 ring-manu-cacau/10"
          >
            <Icone nome={mudo ? "mudo" : "som"} tamanho={30} />
          </button>
        </div>
      </header>

      {estado ? (
        <div
          aria-label={`${estado.acertos} de ${ACERTOS_POR_FASE} acertos`}
          data-acertos={estado.acertos}
          className="flex shrink-0 justify-center gap-1 py-1"
        >
          {Array.from({ length: ACERTOS_POR_FASE }, (_, i) => (
            <span key={i} className={i < estado.acertos ? "" : "opacity-20"}>
              <Icone nome="estrela" tamanho={22} />
            </span>
          ))}
        </div>
      ) : null}

      <div className="relative min-h-0 flex-1 overflow-hidden">
        {estado && estado.fase !== "fase-completa" ? (
          estado.fase === "resolvida" ? (
            <div aria-hidden className="absolute left-1/2 top-[38%] -translate-x-1/2 text-7xl">
              💥
            </div>
          ) : estado.fase === "caindo" ? (
            <div
              ref={meteoro}
              data-conta={estado.rodada.conta}
              aria-label={`quanto é ${estado.rodada.conta}?`}
              className="absolute left-1/2 flex -translate-x-1/2 flex-col items-center"
              style={{ top: "-18%" }}
            >
              <span aria-hidden className="text-6xl">
                ☄️
              </span>
              <span className="-mt-2 rounded-full bg-manu-papel px-4 py-1 font-titulo text-3xl text-manu-cacau shadow-[0_3px_0_0_rgba(0,0,0,0.12)]">
                {estado.rodada.conta}
              </span>
            </div>
          ) : null
        ) : null}

        {estado?.fase === "fase-completa" ? (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-manu-nuvem/95 px-4">
            <Manu pose="comemorando" tamanho={150} className="h-36 w-auto drop-shadow-md" />
            <p className="text-center font-titulo text-3xl text-manu-cacau">Você acertou tudo!</p>
            <div className="flex flex-wrap justify-center gap-4">
              <BotaoBolha rotulo="jogar de novo" tamanho="xl" onClick={jogarDeNovo}>
                <span className="px-3 font-titulo text-2xl">De novo</span>
              </BotaoBolha>
              {estado.nivel < NIVEL_MAXIMO ? (
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

      {estado && estado.fase !== "fase-completa" ? (
        <div className="grid shrink-0 grid-cols-4 gap-3 px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-1">
          {estado.rodada.opcoes.map((opcao, i) => (
            <span
              key={`${estado.rodada.conta}-${i}-${negada?.indice === i ? negada.chave : 0}`}
              className={`block ${negada?.indice === i ? "anima-nao" : ""}`}
            >
              <BotaoBolha rotulo={`resposta ${opcao}`} onClick={() => aoTocarResposta(opcao, i)} className="w-full">
                {opcao}
              </BotaoBolha>
            </span>
          ))}
        </div>
      ) : null}

      {/* gatilho derivado: cada acerto dispara; na fase completa a chuva é longa */}
      <Confete
        gatilho={estado?.acertos ?? 0}
        duracao={estado?.fase === "fase-completa" ? 1800 : 700}
      />
    </main>
  );
}
