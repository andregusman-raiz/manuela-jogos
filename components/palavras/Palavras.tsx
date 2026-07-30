"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { BotaoBolha } from "@/components/ui-kids/BotaoBolha";
import { Confete } from "@/components/ui-kids/Confete";
import { Icone } from "@/components/ui-kids/Icone";
import { Manu } from "@/components/ui-kids/Manu";
import { lerProgresso, salvarProgresso } from "@/lib/armazenamento";
import {
  NIVEL_MAXIMO_PALAVRAS,
  RODADAS_POR_FASE,
  gerarFase,
  proximoNivelPalavras,
  responder,
} from "@/lib/palavras/motor";
import type { NivelPalavras, Rodada } from "@/lib/palavras/tipos";
import { assinarMudo, definirMudo, estaMudo, feedback, mudoNoServidor, tocar } from "@/lib/som";

/**
 * Palavra Mágica — alfabetização (SPEC §4.4): emoji grande + palavra com
 * lacuna; a criança escolhe letra (níveis 1-2) ou sílaba (nível 3) entre 4.
 * Errou: shake + som suave, a palavra PERMANECE até acertar.
 */
export function Palavras() {
  const [nivel, setNivel] = useState<NivelPalavras | null>(null);
  const [fase, setFase] = useState<Rodada[] | null>(null);
  const [indice, setIndice] = useState(0);
  const [preenchida, setPreenchida] = useState(false); // acertou; letra na lacuna
  const [negada, setNegada] = useState<{ opcao: string; chave: number } | null>(null);
  const seed = useRef(1);
  const mudo = useSyncExternalStore(assinarMudo, estaMudo, mudoNoServidor);

  useEffect(() => {
    seed.current = Date.now() % 2147483647;
    void lerProgresso("palavras").then((p) => {
      const n = Math.min(p?.nivel ?? 1, NIVEL_MAXIMO_PALAVRAS) as NivelPalavras;
      setNivel(n);
      setFase(gerarFase(n, seed.current));
    });
  }, []);

  const rodada = fase && indice < fase.length ? fase[indice] : null;
  const completa = fase !== null && indice >= RODADAS_POR_FASE;

  // Acertou: a letra "entra" na lacuna, pisca, e a próxima palavra chega.
  useEffect(() => {
    if (!preenchida) return;
    tocar("acerto");
    const t = setTimeout(() => {
      setPreenchida(false);
      setNegada(null);
      setIndice((i) => i + 1);
    }, 900);
    return () => clearTimeout(t);
  }, [preenchida]);

  useEffect(() => {
    if (!completa || nivel === null) return;
    tocar("vitoria");
    void salvarProgresso("palavras", proximoNivelPalavras(nivel));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completa]);

  function aoTocar(opcao: string) {
    if (!rodada || preenchida) return;
    if (responder(rodada, opcao)) {
      setPreenchida(true);
    } else {
      tocar("erro");
      setNegada((atual) => ({ opcao, chave: (atual?.chave ?? 0) + 1 }));
    }
  }

  function novaFase(n: NivelPalavras) {
    seed.current = (seed.current * 16807) % 2147483647;
    setNivel(n);
    setFase(gerarFase(n, seed.current));
    setIndice(0);
    setPreenchida(false);
    setNegada(null);
  }

  const ehSilaba = nivel === 3;

  return (
    <main data-nivel={nivel ?? 0} className="flex h-[100dvh] flex-col overflow-hidden">
      <header className="flex h-16 shrink-0 items-center gap-2 px-2 pt-[env(safe-area-inset-top)] deitado:h-12">
        <Link
          href="/"
          aria-label="voltar para os jogos"
          onPointerDown={() => feedback("toque")}
          className="bolha h-14 min-h-14 w-14 min-w-14 overflow-hidden bg-manu-rosa/40 ring-2 ring-manu-rosa"
        >
          <Manu pose="rosto" tamanho={56} className="h-14 w-14 object-cover" />
        </Link>
        <h1 className="hidden font-titulo text-xl text-manu-cacau sm:block">Palavra Mágica</h1>
        {nivel !== null ? (
          <span className="rounded-full bg-manu-rosa/60 px-3 py-1 font-titulo text-sm text-manu-cacau">
            Nível {nivel}
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

      {fase ? (
        <div
          aria-label={`${Math.min(indice, RODADAS_POR_FASE)} de ${RODADAS_POR_FASE} palavras`}
          data-acertos={Math.min(indice, RODADAS_POR_FASE)}
          className="flex shrink-0 justify-center gap-1 py-1"
        >
          {Array.from({ length: RODADAS_POR_FASE }, (_, i) => (
            <span key={i} className={i < indice ? "" : "opacity-20"}>
              <Icone nome="estrela" tamanho={22} />
            </span>
          ))}
        </div>
      ) : null}

      <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center gap-5 px-3">
        {rodada && !completa ? (
          <>
            <span aria-hidden className="text-8xl drop-shadow-sm">
              {rodada.emoji}
            </span>
            <p
              data-resposta={rodada.resposta}
              aria-label={`complete a palavra ${rodada.palavra}`}
              className="flex flex-wrap items-end justify-center gap-1 px-2 font-titulo text-5xl tracking-wide text-manu-cacau"
            >
              <span>{rodada.palavra.slice(0, rodada.inicio)}</span>
              <span
                className={`inline-block min-w-12 rounded-xl border-b-4 text-center ${
                  preenchida
                    ? "anima-entrada border-manu-grama bg-manu-grama/30"
                    : "border-manu-rosa-forte bg-manu-rosa/15 text-manu-rosa-forte"
                }`}
              >
                {preenchida ? rodada.resposta : " "}
              </span>
              <span>{rodada.palavra.slice(rodada.fim)}</span>
            </p>
          </>
        ) : null}

        {completa && nivel !== null ? (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-manu-nuvem/95 px-4">
            <Manu pose="comemorando" tamanho={150} className="h-36 w-auto drop-shadow-md" />
            <p className="text-center font-titulo text-3xl text-manu-cacau">
              Você completou todas!
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <BotaoBolha rotulo="jogar de novo" tamanho="xl" onClick={() => novaFase(nivel)}>
                <span className="px-3 font-titulo text-2xl">De novo</span>
              </BotaoBolha>
              {nivel < NIVEL_MAXIMO_PALAVRAS ? (
                <BotaoBolha
                  rotulo="mais difícil"
                  tamanho="xl"
                  efeito="abrir"
                  onClick={() => novaFase(proximoNivelPalavras(nivel))}
                  className="bg-manu-sol"
                >
                  <span className="px-3 font-titulo text-2xl">Mais difícil</span>
                </BotaoBolha>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      {rodada && !completa ? (
        <div className="grid shrink-0 grid-cols-4 gap-3 px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-1">
          {rodada.opcoes.map((opcao) => (
            <span
              key={`${rodada.palavra}-${opcao}-${negada?.opcao === opcao ? negada.chave : 0}`}
              className={`block ${negada?.opcao === opcao ? "anima-nao" : ""}`}
            >
              <BotaoBolha
                rotulo={`opção ${opcao}`}
                onClick={() => aoTocar(opcao)}
                desabilitado={preenchida}
                className="w-full"
              >
                <span className={ehSilaba ? "font-titulo text-2xl" : "font-titulo text-3xl"}>
                  {opcao}
                </span>
              </BotaoBolha>
            </span>
          ))}
        </div>
      ) : null}

      <Confete gatilho={indice} duracao={completa ? 1800 : 700} />
    </main>
  );
}
