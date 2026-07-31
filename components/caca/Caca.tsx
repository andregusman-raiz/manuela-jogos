"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { BotaoBolha } from "@/components/ui-kids/BotaoBolha";
import { Confete } from "@/components/ui-kids/Confete";
import { Icone } from "@/components/ui-kids/Icone";
import { Manu } from "@/components/ui-kids/Manu";
import { lerProgresso, salvarProgresso } from "@/lib/armazenamento";
import {
  NIVEL_MAXIMO_CACA,
  RODADAS_POR_FASE_CACA,
  criarRng,
  gerarRodada,
  proximoNivelCaca,
} from "@/lib/caca/motor";
import type { NivelCaca, RodadaCaca } from "@/lib/caca/motor";
import { assinarMudo, definirMudo, estaMudo, feedback, mudoNoServidor, tocar } from "@/lib/som";

/**
 * Caça-Números — SPEC onda 3 §3.5. Toque em TODOS os números que obedecem à
 * regra; certo vira estrela, errado treme e fica. Rodada fecha quando todos
 * os certos foram achados.
 */
export function Caca() {
  const [nivel, setNivel] = useState<NivelCaca | null>(null);
  const [rodada, setRodada] = useState<RodadaCaca | null>(null);
  const [achados, setAchados] = useState<number[]>([]);
  const [rodadasFeitas, setRodadasFeitas] = useState(0);
  const [negada, setNegada] = useState<{ indice: number; chave: number } | null>(null);
  const rng = useRef<(() => number) | null>(null);
  const mudo = useSyncExternalStore(assinarMudo, estaMudo, mudoNoServidor);

  useEffect(() => {
    rng.current = criarRng((Date.now() % 2147483647) || 1);
    void lerProgresso("caca").then((p) => {
      const n = Math.min(p?.nivel ?? 1, NIVEL_MAXIMO_CACA) as NivelCaca;
      setNivel(n);
      setRodada(gerarRodada(n, rng.current!));
    });
  }, []);

  const completa = rodadasFeitas >= RODADAS_POR_FASE_CACA;
  const restantes = rodada ? rodada.certos.filter((i) => !achados.includes(i)).length : 0;

  useEffect(() => {
    if (!completa || nivel === null) return;
    tocar("vitoria");
    void salvarProgresso("caca", proximoNivelCaca(nivel));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completa]);

  // rodada zerada: pequena pausa e vem a próxima
  useEffect(() => {
    if (!rodada || restantes > 0 || achados.length === 0) return;
    tocar("passo");
    const t = setTimeout(() => {
      setRodadasFeitas((r) => r + 1);
      setAchados([]);
      setNegada(null);
      if (rodadasFeitas + 1 < RODADAS_POR_FASE_CACA && rng.current && nivel !== null) {
        setRodada(gerarRodada(nivel, rng.current));
      }
    }, 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restantes, rodada]);

  function aoTocar(indice: number) {
    if (!rodada || completa || achados.includes(indice)) return;
    if (rodada.certos.includes(indice)) {
      tocar("acerto");
      setAchados((a) => (a.includes(indice) ? a : [...a, indice]));
    } else {
      tocar("erro");
      setNegada((atual) => ({ indice, chave: (atual?.chave ?? 0) + 1 }));
    }
  }

  function novaFase(n: NivelCaca) {
    setNivel(n);
    setRodadasFeitas(0);
    setAchados([]);
    setNegada(null);
    if (rng.current) setRodada(gerarRodada(n, rng.current));
  }

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
        <h1 className="hidden font-titulo text-xl text-manu-cacau sm:block">Caça-Números</h1>
        {nivel !== null ? (
          <span className="rounded-full bg-manu-sol px-3 py-1 font-titulo text-sm text-manu-cacau">
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

      {rodada ? (
        <div
          aria-label={`rodada ${Math.min(rodadasFeitas + 1, RODADAS_POR_FASE_CACA)} de ${RODADAS_POR_FASE_CACA}`}
          data-rodadas={rodadasFeitas}
          className="flex shrink-0 justify-center gap-1 py-1"
        >
          {Array.from({ length: RODADAS_POR_FASE_CACA }, (_, i) => (
            <span key={i} className={i < rodadasFeitas ? "" : "opacity-20"}>
              <Icone nome="estrela" tamanho={22} />
            </span>
          ))}
        </div>
      ) : null}

      {rodada && !completa ? (
        <p
          data-instrucao={
            "alvo" in rodada.instrucao
              ? `${rodada.instrucao.tipo}-de-${rodada.instrucao.alvo}`
              : rodada.instrucao.tipo
          }
          data-restantes={restantes}
          className="shrink-0 py-1 text-center font-titulo text-xl text-manu-cacau"
        >
          {rodada.instrucao.rotulo}
        </p>
      ) : null}

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {rodada && !completa ? (
          <div className="grid aspect-square max-h-full w-full max-w-[min(94vw,56dvh)] grid-cols-4 gap-2">
            {rodada.grade.map((numero, indice) => {
              const achado = achados.includes(indice);
              return (
                <span
                  key={`${rodadasFeitas}-${indice}-${negada?.indice === indice ? negada.chave : 0}`}
                  className={`block ${negada?.indice === indice ? "anima-nao" : ""}`}
                >
                  <button
                    type="button"
                    aria-label={achado ? `número ${numero} achado` : `número ${numero}`}
                    data-numero={numero}
                    data-estado={achado ? "achado" : "livre"}
                    disabled={achado}
                    onPointerDown={() => {
                      if (!achado) feedback("toque");
                    }}
                    onClick={() => aoTocar(indice)}
                    className={`bolha h-full w-full font-titulo text-xl ${
                      achado
                        ? "bg-manu-grama/70 opacity-80"
                        : "bg-manu-papel ring-2 ring-manu-cacau/10"
                    }`}
                  >
                    {achado ? "⭐" : numero}
                  </button>
                </span>
              );
            })}
          </div>
        ) : null}

        {completa && nivel !== null ? (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-manu-nuvem/95 px-4">
            <Manu pose="comemorando" tamanho={150} className="h-36 w-auto drop-shadow-md" />
            <p className="text-center font-titulo text-3xl text-manu-cacau">Caçador de números!</p>
            <div className="flex flex-wrap justify-center gap-4">
              <BotaoBolha rotulo="jogar de novo" tamanho="xl" onClick={() => novaFase(nivel)}>
                <span className="px-3 font-titulo text-2xl">De novo</span>
              </BotaoBolha>
              {nivel < NIVEL_MAXIMO_CACA ? (
                <BotaoBolha
                  rotulo="mais difícil"
                  tamanho="xl"
                  efeito="abrir"
                  onClick={() => novaFase(proximoNivelCaca(nivel))}
                  className="bg-manu-sol"
                >
                  <span className="px-3 font-titulo text-2xl">Mais difícil</span>
                </BotaoBolha>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      <Confete gatilho={completa ? 1 : 0} duracao={1800} />
    </main>
  );
}
