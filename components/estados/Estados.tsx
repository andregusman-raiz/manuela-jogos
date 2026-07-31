"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { BotaoBolha } from "@/components/ui-kids/BotaoBolha";
import { Confete } from "@/components/ui-kids/Confete";
import { Icone } from "@/components/ui-kids/Icone";
import { Manu } from "@/components/ui-kids/Manu";
import { lerProgresso, salvarProgresso } from "@/lib/armazenamento";
import { ESTADOS, type SiglaUF } from "@/lib/estados/mapa";
import {
  NIVEL_MAXIMO_ESTADOS,
  PERGUNTAS_POR_FASE,
  completa as faseCompleta,
  enunciado,
  gerarFase,
  perguntaAtual,
  proximoNivelEstados,
  responder,
} from "@/lib/estados/motor";
import type { FaseEstados, NivelEstados } from "@/lib/estados/motor";
import { assinarMudo, definirMudo, estaMudo, feedback, mudoNoServidor, tocar } from "@/lib/som";

const SIGLAS = Object.keys(ESTADOS) as SiglaUF[];

/** Pinos do litoral leste em coluna à direita (estilo mapa escolar). */
const PINOS = SIGLAS.filter((s) => ESTADOS[s].pino)
  .sort((a, b) => ESTADOS[a].centroide[1] - ESTADOS[b].centroide[1])
  .map((sigla, i, todos) => {
    const [cx, cy] = ESTADOS[sigla].centroide;
    // DF é interior: pino no lugar; litorâneos vão para a coluna x=190
    if (sigla === "DF") return { sigla, x: cx, y: cy, cx, cy };
    const passo = 180 / Math.max(todos.length - 1, 1);
    return { sigla, x: 190, y: 12 + i * passo, cx, cy };
  });

export function Estados() {
  const [nivel, setNivel] = useState<NivelEstados | null>(null);
  const [fase, setFase] = useState<FaseEstados | null>(null);
  const [tremida, setTremida] = useState<{ uf: SiglaUF; chave: number } | null>(null);
  const [scaffold, setScaffold] = useState<{ uf: SiglaUF; chave: number } | null>(null);
  const respondidaRef = useRef<number>(-1);
  const mudo = useSyncExternalStore(assinarMudo, estaMudo, mudoNoServidor);

  useEffect(() => {
    void lerProgresso("estados").then((p) => {
      const n = Math.min(p?.nivel ?? 1, NIVEL_MAXIMO_ESTADOS) as NivelEstados;
      setNivel(n);
      setFase(gerarFase(n, (Date.now() % 2147483647) || 1));
    });
  }, []);

  const acabou = fase ? faseCompleta(fase) : false;

  // SPEC: o scaffold pisca ~2× e APAGA — sem isto ficava aceso para sempre
  useEffect(() => {
    if (!scaffold) return;
    const t = setTimeout(() => setScaffold(null), 1600);
    return () => clearTimeout(t);
  }, [scaffold]);

  useEffect(() => {
    if (!acabou || nivel === null) return;
    tocar("vitoria");
    void salvarProgresso("estados", proximoNivelEstados(nivel));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acabou]);

  function aoTocarUF(uf: SiglaUF) {
    if (!fase || acabou) return;
    if (respondidaRef.current === fase.indice && perguntaAtual(fase) === null) return;
    const { fase: nova, evento } = responder(fase, uf);
    if (evento === "nada") return;
    if (evento === "acerto") {
      // guard síncrono: dois toques no mesmo tick veem o mesmo indice
      if (respondidaRef.current === fase.indice) return;
      respondidaRef.current = fase.indice;
      tocar("acerto");
      setScaffold(null);
      setTremida(null);
      setFase(nova);
      return;
    }
    tocar("erro");
    setTremida((t) => ({ uf, chave: (t?.chave ?? 0) + 1 }));
    if (evento === "scaffold") {
      const alvo = perguntaAtual(fase)!;
      setScaffold((s) => ({ uf: alvo, chave: (s?.chave ?? 0) + 1 }));
    }
    setFase(nova);
  }

  function novaFase(n: NivelEstados) {
    respondidaRef.current = -1;
    setNivel(n);
    setTremida(null);
    setScaffold(null);
    setFase(gerarFase(n, (Date.now() % 2147483647) || 1));
  }

  const pedida = fase ? perguntaAtual(fase) : null;

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
        <h1 className="hidden font-titulo text-xl text-manu-cacau sm:block">Estados do Brasil</h1>
        {nivel !== null ? (
          <span className="rounded-full bg-manu-grama/70 px-3 py-1 font-titulo text-sm text-manu-cacau">
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
          aria-label={`${fase.acertos} de ${PERGUNTAS_POR_FASE} acertos`}
          data-acertos={fase.acertos}
          className="flex shrink-0 justify-center gap-1 py-1"
        >
          {Array.from({ length: PERGUNTAS_POR_FASE }, (_, i) => (
            <span key={i} className={i < fase.acertos ? "" : "opacity-20"}>
              <Icone nome="estrela" tamanho={20} />
            </span>
          ))}
        </div>
      ) : null}

      {fase && pedida && nivel !== null && !acabou ? (
        <p
          data-uf-pedida={pedida}
          className="shrink-0 py-1 text-center font-titulo text-xl text-manu-cacau"
        >
          {enunciado(nivel, pedida)}
        </p>
      ) : null}

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {fase && !acabou ? (
          <svg viewBox="0 0 200 200" role="img" aria-label="mapa do Brasil" className="h-full max-h-full w-auto max-w-full">
            {SIGLAS.map((sigla) => (
              <g
                key={`${sigla}-${tremida?.uf === sigla ? tremida.chave : 0}`}
                className={tremida?.uf === sigla ? "anima-nao" : ""}
              >
                <path
                  data-uf={sigla}
                  d={ESTADOS[sigla].path}
                  fill={scaffold?.uf === sigla ? "#f8de7b" : "#b8dca6"}
                  stroke="#2e1408"
                  strokeWidth="0.6"
                  className={scaffold?.uf === sigla ? "anima-brilho" : ""}
                  data-scaffold={scaffold?.uf === sigla ? "true" : "false"}
                  onPointerDown={() => feedback("toque")}
                  onClick={() => aoTocarUF(sigla)}
                />
              </g>
            ))}
            {PINOS.map(({ sigla, x, y, cx, cy }) => (
              <g key={`pino-${sigla}-${tremida?.uf === sigla ? tremida.chave : 0}`}>
                {x !== cx ? (
                  <line x1={cx} y1={cy} x2={x} y2={y} stroke="#6b4630" strokeWidth="0.5" opacity="0.6" />
                ) : null}
                <circle
                  data-uf={sigla}
                  data-pino="true"
                  data-scaffold={scaffold?.uf === sigla ? "true" : "false"}
                  cx={x}
                  cy={y}
                  r="10"
                  fill={scaffold?.uf === sigla ? "#f8de7b" : "#fff9f3"}
                  stroke="#6b4630"
                  strokeWidth="1"
                  className={
                    (tremida?.uf === sigla ? "anima-nao " : "") +
                    (scaffold?.uf === sigla ? "anima-brilho" : "")
                  }
                  onPointerDown={() => feedback("toque")}
                  onClick={() => aoTocarUF(sigla)}
                />
                <text x={x} y={y + 2.2} textAnchor="middle" fontSize="6" fontWeight="700" fill="#2e1408" pointerEvents="none">
                  {sigla}
                </text>
              </g>
            ))}
          </svg>
        ) : null}

        {acabou && nivel !== null ? (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-manu-nuvem/95 px-4">
            <Manu pose="comemorando" tamanho={150} className="h-36 w-auto drop-shadow-md" />
            <p className="text-center font-titulo text-3xl text-manu-cacau">Que viajante!</p>
            <div className="flex flex-wrap justify-center gap-4">
              <BotaoBolha rotulo="jogar de novo" tamanho="xl" onClick={() => novaFase(nivel)}>
                <span className="px-3 font-titulo text-2xl">De novo</span>
              </BotaoBolha>
              {nivel < NIVEL_MAXIMO_ESTADOS ? (
                <BotaoBolha
                  rotulo="mais difícil"
                  tamanho="xl"
                  efeito="abrir"
                  onClick={() => novaFase(proximoNivelEstados(nivel))}
                  className="bg-manu-sol"
                >
                  <span className="px-3 font-titulo text-2xl">Mais difícil</span>
                </BotaoBolha>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      <Confete gatilho={acabou ? 1 : 0} duracao={1800} />
    </main>
  );
}
