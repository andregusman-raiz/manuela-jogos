"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { BotaoBolha } from "@/components/ui-kids/BotaoBolha";
import { Confete } from "@/components/ui-kids/Confete";
import { Icone } from "@/components/ui-kids/Icone";
import { Manu } from "@/components/ui-kids/Manu";
import { lerProgresso, salvarProgresso } from "@/lib/armazenamento";
import {
  SEQUENCIA_ALVO,
  TAMANHO_INICIAL,
  avancarReplay,
  criarPartida,
  ouvir,
} from "@/lib/genius/motor";
import type { EstadoGenius } from "@/lib/genius/motor";
import type { Efeito } from "@/lib/som";
import { assinarMudo, definirMudo, estaMudo, feedback, mudoNoServidor, tocar } from "@/lib/som";

const NOTAS: Efeito[] = ["nota1", "nota2", "nota3", "nota4"];
const CORES = [
  { nome: "rosa", classe: "bg-manu-rosa", aceso: "ring-8 ring-manu-rosa-forte brightness-110" },
  { nome: "azul", classe: "bg-manu-ceu", aceso: "ring-8 ring-manu-ceu-claro brightness-110" },
  { nome: "amarelo", classe: "bg-manu-sol", aceso: "ring-8 ring-manu-sol-forte brightness-110" },
  { nome: "verde", classe: "bg-manu-grama", aceso: "ring-8 ring-manu-grama brightness-110" },
];

/**
 * Genius dos Sons — Simon (SPEC onda 2 §3.4). A máquina inteira vive no motor;
 * aqui só existem timers de 450ms que despacham avancarReplay e pintam o item
 * corrente. Toque durante o replay é no-op POR CONSTRUÇÃO (motor).
 */
export function Genius() {
  const [estado, setEstado] = useState<EstadoGenius | null>(null);
  const [carregou, setCarregou] = useState(false);
  const [recorde, setRecorde] = useState(0);
  const [negacao, setNegacao] = useState(0);
  const anterior = useRef<{ tamanho: number; fase: string } | null>(null);
  const mudo = useSyncExternalStore(assinarMudo, estaMudo, mudoNoServidor);

  useEffect(() => {
    void lerProgresso("genius").then((p) => {
      setRecorde(p?.nivel ?? 0);
      setCarregou(true);
    });
  }, []);

  // A partida SÓ nasce de um gesto: sem toque, o WebAudio fica suspenso pela
  // política de autoplay e o replay inicial sairia MUDO — num jogo de memória
  // auditiva isso é fatal (blocker do review).
  function comecar() {
    anterior.current = null;
    setNegacao(0);
    setEstado(criarPartida((Date.now() % 2147483647) || 1));
  }

  const fase = estado?.fase;
  const indiceReplay = estado?.indiceReplay ?? 0;
  const tamanho = estado?.tamanho ?? 0;

  // Replay: toca a nota do item corrente e agenda o próximo passo. O PRIMEIRO
  // item espera 700ms — sem o respiro, a nota colide com o som de acerto/erro
  // da transição e a criança não distingue o começo da sequência.
  useEffect(() => {
    if (!estado || fase !== "mostrando") return;
    const respiro = indiceReplay === 0 ? 700 : 0;
    const nota = NOTAS[estado.sequencia[indiceReplay]];
    const t0 = setTimeout(() => tocar(nota), respiro);
    const t1 = setTimeout(() => setEstado((e) => (e ? avancarReplay(e) : e)), respiro + 450);
    return () => {
      clearTimeout(t0);
      clearTimeout(t1);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fase, indiceReplay]);

  // Sons e persistência seguem TRANSIÇÕES reais (comparadas com o passo anterior).
  useEffect(() => {
    if (!estado) return;
    const antes = anterior.current;
    anterior.current = { tamanho: estado.tamanho, fase: estado.fase };
    if (!antes) return;

    if (estado.fase === "fase-completa" && antes.fase !== "fase-completa") {
      tocar("vitoria");
      void salvarProgresso("genius", SEQUENCIA_ALVO);
      setRecorde((r) => Math.max(r, SEQUENCIA_ALVO));
      return;
    }
    if (estado.tamanho > antes.tamanho) {
      // repetiu o prefixo: cresce — o que foi repetido vira recorde candidato
      tocar("acerto");
      void salvarProgresso("genius", antes.tamanho);
      setRecorde((r) => Math.max(r, antes.tamanho));
      return;
    }
    if (antes.fase === "ouvindo" && estado.fase === "mostrando") {
      // errou: replay do MESMO prefixo
      tocar("erro");
      setNegacao((n) => n + 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fase, tamanho]);

  function aoTocarBotao(indice: number) {
    if (!estado || estado.fase !== "ouvindo") return;
    tocar(NOTAS[indice]);
    setEstado((e) => (e ? ouvir(e, indice) : e));
  }

  const deNovo = comecar;

  const aceso = estado && fase === "mostrando" ? estado.sequencia[indiceReplay] : null;

  return (
    <main data-nivel={recorde} className="flex h-[100dvh] flex-col overflow-hidden">
      <header className="flex h-16 shrink-0 items-center gap-2 px-2 pt-[env(safe-area-inset-top)] deitado:h-12">
        <Link
          href="/"
          aria-label="voltar para os jogos"
          onPointerDown={() => feedback("toque")}
          className="bolha h-14 min-h-14 w-14 min-w-14 overflow-hidden bg-manu-rosa/40 ring-2 ring-manu-rosa"
        >
          <Manu pose="rosto" tamanho={56} className="h-14 w-14 object-cover" />
        </Link>
        <h1 className="hidden font-titulo text-xl text-manu-cacau sm:block">Genius dos Sons</h1>
        {estado ? (
          <span className="rounded-full bg-manu-ceu px-3 py-1 font-titulo text-sm text-manu-cacau">
            {recorde > 0 ? `Recorde ${recorde}` : "Escute e repita"}
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
          data-seq={estado.sequencia.join(",")}
          data-tamanho={estado.tamanho}
          data-fase-genius={estado.fase}
          aria-label={
            estado.fase === "mostrando"
              ? "escute a sequência"
              : estado.fase === "ouvindo"
                ? "sua vez de repetir"
                : "sequência completa"
          }
          className="shrink-0 py-1 text-center font-titulo text-lg text-manu-cacau-suave"
        >
          {estado.fase === "mostrando"
            ? "Escute…"
            : estado.fase === "ouvindo"
              ? `Sua vez! (${estado.tamanho} sons)`
              : "Você lembrou tudo!"}
        </div>
      ) : null}

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {!estado && carregou ? (
          <div className="flex flex-col items-center gap-4">
            <Manu pose="corpo" tamanho={140} className="h-40 w-auto drop-shadow-md" />
            <BotaoBolha rotulo="começar a jogar" tamanho="xl" efeito="abrir" onClick={comecar}>
              <span className="px-4 font-titulo text-2xl">Começar ▶</span>
            </BotaoBolha>
          </div>
        ) : null}
        {estado && fase !== "fase-completa" ? (
          <div
            key={`tabuleiro-${negacao}`}
            className={`grid aspect-square w-full max-w-[min(88vw,56dvh)] grid-cols-2 gap-3 ${
              negacao > 0 ? "anima-nao" : ""
            }`}
          >
            {CORES.map((cor, indice) => (
              <button
                key={cor.nome}
                type="button"
                aria-label={`botão ${cor.nome}`}
                data-aceso={aceso === indice ? "true" : "false"}
                disabled={fase !== "ouvindo"}
                onClick={() => aoTocarBotao(indice)}
                className={`rounded-[2rem] shadow-[0_5px_0_0_rgba(0,0,0,0.12)] transition active:translate-y-1 ${cor.classe} ${
                  aceso === indice ? cor.aceso : "ring-2 ring-manu-cacau/10"
                } ${fase !== "ouvindo" && aceso !== indice ? "opacity-80" : ""}`}
              />
            ))}
          </div>
        ) : null}

        {estado?.fase === "fase-completa" ? (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-manu-nuvem/95 px-4">
            <Manu pose="comemorando" tamanho={150} className="h-36 w-auto drop-shadow-md" />
            <p className="text-center font-titulo text-3xl text-manu-cacau">
              Que memória! {SEQUENCIA_ALVO} sons seguidos!
            </p>
            <BotaoBolha rotulo="jogar de novo" tamanho="xl" onClick={deNovo}>
              <span className="px-3 font-titulo text-2xl">De novo</span>
            </BotaoBolha>
          </div>
        ) : null}
      </div>

      <Confete gatilho={estado?.fase === "fase-completa" ? 1 : 0} duracao={1800} />
    </main>
  );
}
