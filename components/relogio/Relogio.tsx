"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { BotaoBolha } from "@/components/ui-kids/BotaoBolha";
import { Confete } from "@/components/ui-kids/Confete";
import { Icone } from "@/components/ui-kids/Icone";
import { Manu } from "@/components/ui-kids/Manu";
import { lerProgresso, salvarProgresso } from "@/lib/armazenamento";
import {
  ACERTOS_POR_FASE_RELOGIO,
  NIVEL_MAXIMO_RELOGIO,
  criarRng,
  gerarRodada,
  proximoNivelRelogio,
} from "@/lib/relogio/motor";
import type { NivelRelogio, RodadaRelogio } from "@/lib/relogio/motor";
import { assinarMudo, definirMudo, estaMudo, feedback, mudoNoServidor, tocar } from "@/lib/som";

/**
 * Relógio Mágico — ler horas no analógico (SPEC onda 2 §3.2). O ponteiro de
 * hora ANDA com os minutos (h%12×30° + m×0.5°) — é o que ensina a ler de
 * verdade. SVG 100% próprio; os graus vêm do motor e ficam expostos em
 * data-graus-* (o E2E confere o desenho contra a hora, não só o rótulo).
 */
export function Relogio() {
  const [nivel, setNivel] = useState<NivelRelogio | null>(null);
  const [rodada, setRodada] = useState<RodadaRelogio | null>(null);
  const [acertos, setAcertos] = useState(0);
  const [negada, setNegada] = useState<{ opcao: string; chave: number } | null>(null);
  const rng = useRef<(() => number) | null>(null);
  const mudo = useSyncExternalStore(assinarMudo, estaMudo, mudoNoServidor);

  useEffect(() => {
    rng.current = criarRng((Date.now() % 2147483647) || 1);
    void lerProgresso("relogio").then((p) => {
      const n = Math.min(p?.nivel ?? 1, NIVEL_MAXIMO_RELOGIO) as NivelRelogio;
      setNivel(n);
      setRodada(gerarRodada(n, rng.current!));
    });
  }, []);

  const completa = acertos >= ACERTOS_POR_FASE_RELOGIO;

  useEffect(() => {
    if (!completa || nivel === null) return;
    tocar("vitoria");
    void salvarProgresso("relogio", proximoNivelRelogio(nivel));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completa]);

  function aoResponder(opcao: string) {
    if (!rodada || !rng.current || completa) return;
    if (opcao === rodada.rotulo) {
      tocar("acerto");
      setNegada(null);
      setAcertos((a) => a + 1);
      if (acertos + 1 < ACERTOS_POR_FASE_RELOGIO) setRodada(gerarRodada(nivel!, rng.current));
    } else {
      tocar("erro");
      setNegada((atual) => ({ opcao, chave: (atual?.chave ?? 0) + 1 }));
    }
  }

  function novaFase(n: NivelRelogio) {
    if (!rng.current) return;
    setNivel(n);
    setAcertos(0);
    setNegada(null);
    setRodada(gerarRodada(n, rng.current));
  }

  const numeros = Array.from({ length: 12 }, (_, i) => {
    const n = i + 1;
    const rad = ((n % 12) * 30 * Math.PI) / 180;
    return { n, x: 100 + 78 * Math.sin(rad), y: 100 - 78 * Math.cos(rad) };
  });

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
        <h1 className="hidden font-titulo text-xl text-manu-cacau sm:block">Relógio Mágico</h1>
        {nivel !== null ? (
          <span className="rounded-full bg-manu-sol/70 px-3 py-1 font-titulo text-sm text-manu-cacau">
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
          aria-label={`${Math.min(acertos, ACERTOS_POR_FASE_RELOGIO)} de ${ACERTOS_POR_FASE_RELOGIO} acertos`}
          data-acertos={acertos}
          className="flex shrink-0 justify-center gap-1 py-1"
        >
          {Array.from({ length: ACERTOS_POR_FASE_RELOGIO }, (_, i) => (
            <span key={i} className={i < acertos ? "" : "opacity-20"}>
              <Icone nome="estrela" tamanho={22} />
            </span>
          ))}
        </div>
      ) : null}

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-3">
        {rodada && !completa ? (
          <svg
            viewBox="0 0 200 200"
            role="img"
            aria-label="que horas o relógio mostra?"
            data-hora={rodada.rotulo}
            className="h-full max-h-[46dvh] w-auto max-w-full drop-shadow-md"
          >
            <circle cx="100" cy="100" r="94" fill="#ffffff" stroke="#2e1408" strokeWidth="5" />
            {numeros.map(({ n, x, y }) => (
              <text
                key={n}
                x={x}
                y={y + 6}
                textAnchor="middle"
                fontSize="17"
                fontWeight="700"
                fill="#2e1408"
              >
                {n}
              </text>
            ))}
            {Array.from({ length: 60 }, (_, i) => {
              const rad = (i * 6 * Math.PI) / 180;
              const grande = i % 5 === 0;
              const r1 = grande ? 86 : 90;
              return (
                <line
                  key={i}
                  x1={100 + r1 * Math.sin(rad)}
                  y1={100 - r1 * Math.cos(rad)}
                  x2={100 + 93 * Math.sin(rad)}
                  y2={100 - 93 * Math.cos(rad)}
                  stroke="#2e1408"
                  strokeWidth={grande ? 2.5 : 1}
                  opacity={grande ? 0.8 : 0.35}
                />
              );
            })}
            <line
              data-ponteiro="hora"
              data-graus-hora={rodada.angulos.horaGraus}
              x1="100"
              y1="100"
              x2="100"
              y2="55"
              stroke="#c2517f"
              strokeWidth="8"
              strokeLinecap="round"
              transform={`rotate(${rodada.angulos.horaGraus} 100 100)`}
            />
            <line
              data-ponteiro="minuto"
              data-graus-minuto={rodada.angulos.minutoGraus}
              x1="100"
              y1="100"
              x2="100"
              y2="30"
              stroke="#2e1408"
              strokeWidth="5"
              strokeLinecap="round"
              transform={`rotate(${rodada.angulos.minutoGraus} 100 100)`}
            />
            <circle cx="100" cy="100" r="6" fill="#2e1408" />
          </svg>
        ) : null}

        {completa && nivel !== null ? (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-manu-nuvem/95 px-4">
            <Manu pose="comemorando" tamanho={150} className="h-36 w-auto drop-shadow-md" />
            <p className="text-center font-titulo text-3xl text-manu-cacau">Que olho no relógio!</p>
            <div className="flex flex-wrap justify-center gap-4">
              <BotaoBolha rotulo="jogar de novo" tamanho="xl" onClick={() => novaFase(nivel)}>
                <span className="px-3 font-titulo text-2xl">De novo</span>
              </BotaoBolha>
              {nivel < NIVEL_MAXIMO_RELOGIO ? (
                <BotaoBolha
                  rotulo="mais difícil"
                  tamanho="xl"
                  efeito="abrir"
                  onClick={() => novaFase(proximoNivelRelogio(nivel))}
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
              key={`${rodada.rotulo}-${opcao}-${negada?.opcao === opcao ? negada.chave : 0}`}
              className={`block ${negada?.opcao === opcao ? "anima-nao" : ""}`}
            >
              <BotaoBolha rotulo={`resposta ${opcao}`} onClick={() => aoResponder(opcao)} className="w-full">
                <span className="font-titulo text-2xl">{opcao}</span>
              </BotaoBolha>
            </span>
          ))}
        </div>
      ) : null}

      <Confete gatilho={completa ? 1 : 0} duracao={1800} />
    </main>
  );
}
