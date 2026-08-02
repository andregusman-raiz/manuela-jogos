"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { BotaoBolha } from "@/components/ui-kids/BotaoBolha";
import { Confete } from "@/components/ui-kids/Confete";
import { Icone } from "@/components/ui-kids/Icone";
import { Manu } from "@/components/ui-kids/Manu";
import { lerProgresso, salvarProgresso } from "@/lib/armazenamento";
import {
  ACERTOS_POR_FASE_FRACOES,
  NIVEL_MAXIMO_FRACOES,
  alternarFatia,
  anguloDaFatia,
  comparar,
  conferir,
  criarRng,
  gerarRodada,
  proximoNivelFracoes,
  rotular,
} from "@/lib/fracoes/motor";
import type { Fracao, NivelFracoes, RodadaFracoes } from "@/lib/fracoes/motor";
import { assinarMudo, definirMudo, estaMudo, feedback, mudoNoServidor, tocar } from "@/lib/som";

function pontoNaBorda(graus: number): [number, number] {
  const rad = (graus * Math.PI) / 180;
  return [100 + 88 * Math.sin(rad), 100 - 88 * Math.cos(rad)];
}

/** Uma pizza SVG: fatias por path, pintura por índice. */
function Pizza({
  fracao,
  pintadas,
  aoTocarFatia,
  rotuloAcessivel,
}: {
  fracao: Fracao;
  pintadas: boolean[];
  aoTocarFatia?: (k: number) => void;
  rotuloAcessivel: string;
}) {
  return (
    <svg
      viewBox="0 0 200 200"
      role="img"
      aria-label={rotuloAcessivel}
      // SEM drop-shadow aqui: filter na raiz de SVG quebra o primeiro paint
      // no iOS Safari (a pizza ficava invisível até a primeira interação);
      // aspect-square dá largura computável no primeiro layout (w-auto de
      // SVG também colapsa no iOS)
      className="aspect-square h-full max-h-full w-auto max-w-full"
    >
      {Array.from({ length: fracao.d }, (_, k) => {
        const { inicio, fim } = anguloDaFatia(k, fracao.d);
        const [x1, y1] = pontoNaBorda(inicio);
        const [x2, y2] = pontoNaBorda(fim);
        const arcoGrande = fim - inicio > 180 ? 1 : 0;
        return (
          <path
            key={k}
            data-fatia={k}
            data-pintada={pintadas[k] ? "true" : "false"}
            d={`M 100 100 L ${x1} ${y1} A 88 88 0 ${arcoGrande} 1 ${x2} ${y2} Z`}
            fill={pintadas[k] ? "#f09bc0" : "#ffffff"}
            stroke="#2e1408"
            strokeWidth="3"
            onClick={aoTocarFatia ? () => aoTocarFatia(k) : undefined}
            onPointerDown={aoTocarFatia ? () => feedback("toque") : undefined}
          />
        );
      })}
    </svg>
  );
}

export function Fracoes() {
  const [nivel, setNivel] = useState<NivelFracoes | null>(null);
  const [rodada, setRodada] = useState<RodadaFracoes | null>(null);
  const [acertos, setAcertos] = useState(0);
  const [negada, setNegada] = useState<{ opcao: string; chave: number } | null>(null);
  const rng = useRef<(() => number) | null>(null);
  // guardas SÍNCRONAS (padrão da Lojinha): dois cliques no mesmo tick veem a
  // MESMA rodada renderizada — a identidade dela barra o segundo
  const respondida = useRef<RodadaFracoes | null>(null);
  const acertosRef = useRef(0);
  const mudo = useSyncExternalStore(assinarMudo, estaMudo, mudoNoServidor);

  useEffect(() => {
    rng.current = criarRng((Date.now() % 2147483647) || 1);
    void lerProgresso("fracoes").then((p) => {
      const n = Math.min(p?.nivel ?? 1, NIVEL_MAXIMO_FRACOES) as NivelFracoes;
      setNivel(n);
      setRodada(gerarRodada(n, rng.current!));
    });
  }, []);

  const completa = acertos >= ACERTOS_POR_FASE_FRACOES;

  useEffect(() => {
    if (!completa || nivel === null) return;
    tocar("vitoria");
    void salvarProgresso("fracoes", proximoNivelFracoes(nivel));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completa]);

  function acertou(daRodada: RodadaFracoes) {
    if (respondida.current === daRodada) return; // segundo clique do mesmo tick
    respondida.current = daRodada;
    tocar("acerto");
    setNegada(null);
    acertosRef.current += 1;
    setAcertos(acertosRef.current);
    if (acertosRef.current < ACERTOS_POR_FASE_FRACOES && rng.current && nivel !== null) {
      setRodada(gerarRodada(nivel, rng.current));
    }
  }

  function errou(opcao: string) {
    tocar("erro");
    setNegada((atual) => ({ opcao, chave: (atual?.chave ?? 0) + 1 }));
  }

  function aoResponderLer(opcao: string) {
    if (!rodada || rodada.tipo !== "ler" || completa) return;
    if (opcao === rotular(rodada.alvo)) acertou(rodada);
    else errou(opcao);
  }

  function aoTocarFatia(k: number) {
    setRodada((r) => (r && r.tipo === "construir" ? alternarFatia(r, k) : r));
  }

  function aoConferir() {
    if (!rodada || rodada.tipo !== "construir" || completa) return;
    const resultado = conferir(rodada);
    if (resultado.rodada === rodada && resultado.certo) return; // já resolvida (idempotente)
    if (resultado.certo) acertou(rodada);
    else errou("conferir");
  }

  function aoComparar(resposta: "a" | "igual" | "b") {
    if (!rodada || rodada.tipo !== "comparar" || completa) return;
    if (comparar(rodada.a, rodada.b) === resposta) acertou(rodada);
    else errou(resposta);
  }

  function novaFase(n: NivelFracoes) {
    respondida.current = null;
    acertosRef.current = 0;
    setNivel(n);
    setAcertos(0);
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
        <h1 className="hidden font-titulo text-xl text-manu-cacau sm:block">Pizza das Frações</h1>
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

      {rodada ? (
        <div
          aria-label={`${Math.min(acertos, ACERTOS_POR_FASE_FRACOES)} de ${ACERTOS_POR_FASE_FRACOES} acertos`}
          data-acertos={acertos}
          className="flex shrink-0 justify-center gap-1 py-1"
        >
          {Array.from({ length: ACERTOS_POR_FASE_FRACOES }, (_, i) => (
            <span key={i} className={i < acertos ? "" : "opacity-20"}>
              <Icone nome="estrela" tamanho={22} />
            </span>
          ))}
        </div>
      ) : null}

      <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-3">
        {rodada && !completa ? (
          rodada.tipo === "comparar" ? (
            <div
              data-fracoes={`${rotular(rodada.a)}|${rotular(rodada.b)}`}
              className="flex h-full max-h-[44dvh] w-full items-center justify-center gap-4"
            >
              <Pizza
                fracao={rodada.a}
                pintadas={Array.from({ length: rodada.a.d }, (_, k) => k < rodada.a.n)}
                rotuloAcessivel={`primeira pizza: ${rotular(rodada.a)}`}
              />
              <span className="font-titulo text-2xl text-manu-cacau-suave">ou</span>
              <Pizza
                fracao={rodada.b}
                pintadas={Array.from({ length: rodada.b.d }, (_, k) => k < rodada.b.n)}
                rotuloAcessivel={`segunda pizza: ${rotular(rodada.b)}`}
              />
            </div>
          ) : (
            <>
              {rodada.tipo === "construir" ? (
                <p className="font-titulo text-2xl text-manu-cacau">
                  Pinte <span className="text-manu-rosa-texto">{rotular(rodada.alvo)}</span> da pizza
                </p>
              ) : (
                <p className="font-titulo text-2xl text-manu-cacau">Quanto está pintado?</p>
              )}
              <div
                data-fracao={rotular(rodada.alvo)}
                data-pintadas={
                  rodada.tipo === "construir"
                    ? rodada.pintadas.filter(Boolean).length
                    : rodada.alvo.n
                }
                className="h-full max-h-[40dvh]"
              >
                <Pizza
                  fracao={rodada.alvo}
                  pintadas={
                    rodada.tipo === "construir"
                      ? rodada.pintadas
                      : Array.from({ length: rodada.alvo.d }, (_, k) => k < rodada.alvo.n)
                  }
                  aoTocarFatia={rodada.tipo === "construir" ? aoTocarFatia : undefined}
                  rotuloAcessivel={
                    rodada.tipo === "construir"
                      ? `pizza para pintar ${rotular(rodada.alvo)}`
                      : "pizza da pergunta"
                  }
                />
              </div>
            </>
          )
        ) : null}

        {completa && nivel !== null ? (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-manu-nuvem/95 px-4">
            <Manu pose="comemorando" tamanho={150} className="h-36 w-auto drop-shadow-md" />
            <p className="text-center font-titulo text-3xl text-manu-cacau">Mestre das pizzas!</p>
            <div className="flex flex-wrap justify-center gap-4">
              <BotaoBolha rotulo="jogar de novo" tamanho="xl" onClick={() => novaFase(nivel)}>
                <span className="px-3 font-titulo text-2xl">De novo</span>
              </BotaoBolha>
              {nivel < NIVEL_MAXIMO_FRACOES ? (
                <BotaoBolha
                  rotulo="mais difícil"
                  tamanho="xl"
                  efeito="abrir"
                  onClick={() => novaFase(proximoNivelFracoes(nivel))}
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
        <div className="shrink-0 px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-1">
          {rodada.tipo === "ler" ? (
            <div className="grid grid-cols-4 gap-3">
              {rodada.opcoes.map((opcao) => (
                <span
                  key={`${rotular(rodada.alvo)}-${opcao}-${negada?.opcao === opcao ? negada.chave : 0}`}
                  className={`block ${negada?.opcao === opcao ? "anima-nao" : ""}`}
                >
                  <BotaoBolha rotulo={`fração ${opcao}`} onClick={() => aoResponderLer(opcao)} className="w-full">
                    <span className="font-titulo text-2xl">{opcao}</span>
                  </BotaoBolha>
                </span>
              ))}
            </div>
          ) : rodada.tipo === "construir" ? (
            <div className="flex justify-center">
              <span
                key={`conferir-${negada?.opcao === "conferir" ? negada.chave : 0}`}
                className={`block ${negada?.opcao === "conferir" ? "anima-nao" : ""}`}
              >
                <BotaoBolha rotulo="conferir" tamanho="xl" efeito="abrir" onClick={aoConferir} className="bg-manu-grama">
                  <span className="px-3 font-titulo text-2xl">Conferir</span>
                </BotaoBolha>
              </span>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {(
                [
                  ["a", "a primeira"],
                  ["igual", "são iguais"],
                  ["b", "a segunda"],
                ] as const
              ).map(([valor, rotulo]) => (
                <span
                  key={`${valor}-${negada?.opcao === valor ? negada.chave : 0}`}
                  className={`block ${negada?.opcao === valor ? "anima-nao" : ""}`}
                >
                  <BotaoBolha rotulo={rotulo} onClick={() => aoComparar(valor)} className="w-full">
                    <span className="font-titulo text-lg">{rotulo}</span>
                  </BotaoBolha>
                </span>
              ))}
            </div>
          )}
        </div>
      ) : null}

      <Confete gatilho={completa ? 1 : 0} duracao={1800} />
    </main>
  );
}
