"use client";

import Link from "next/link";
import { IDENTIDADE, aMascote, comAMascote } from "@/lib/identidade";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { BotaoBolha } from "@/components/ui-kids/BotaoBolha";
import { Confete } from "@/components/ui-kids/Confete";
import { Icone } from "@/components/ui-kids/Icone";
import { Mascote } from "@/components/ui-kids/Mascote";
import { lerProgresso, salvarProgresso } from "@/lib/armazenamento";
import { criarSorte, sementeInicial } from "@/lib/dado";
import {
  COLUNAS,
  LINHAS,
  colunasLegais,
  criarPartida,
  iaJogar,
  jogar,
} from "@/lib/lig4/motor";
import type { EstadoLig4 } from "@/lib/lig4/motor";
import { assinarMudo, definirMudo, estaMudo, feedback, mudoNoServidor, tocar } from "@/lib/som";

type Modo = "2p" | "manu";
type NivelLig4 = 1 | 2;

const DISTRACAO: Record<NivelLig4, number> = { 1: 0.3, 2: 0.1 };
const NOMES = ["Rosa", "Azul"] as const;

export function Lig4() {
  const [modo, setModo] = useState<Modo | null>(null);
  const [estado, setEstado] = useState<EstadoLig4 | null>(null);
  const [nivelMax, setNivelMax] = useState<NivelLig4>(1);
  const [nivel, setNivel] = useState<NivelLig4>(1);
  const [semente, setSemente] = useState(0);
  const sorte = useRef<(() => number) | null>(null);
  const mudo = useSyncExternalStore(assinarMudo, estaMudo, mudoNoServidor);

  useEffect(() => {
    const s = sementeInicial(window.location.search);
    sorte.current = criarSorte(s);
    void lerProgresso("lig4").then((p) => {
      setSemente(s);
      setNivelMax(Math.min(p?.nivel ?? 1, 2) as NivelLig4);
    });
  }, []);

  const situacao = estado?.situacao;

  // vez da Manu: pensa 600ms e joga (efeito segue transição real de estado)
  useEffect(() => {
    if (!estado || modo !== "manu" || estado.situacao !== "jogando" || estado.vez !== 1) return;
    const t = setTimeout(() => {
      if (!sorte.current) return;
      const coluna = iaJogar(estado, sorte.current, DISTRACAO[nivel]);
      tocar("toque");
      setEstado(jogar(estado, coluna));
    }, 600);
    return () => clearTimeout(t);
  }, [estado, modo, nivel]);

  useEffect(() => {
    if (!estado || situacao !== "fim") return;
    const humanoVenceu = modo === "manu" && estado.vencedor === 0;
    const empatou = estado.vencedor === null;
    tocar(empatou ? "passo" : modo === "manu" && !humanoVenceu ? "erro" : "vitoria");
    if (humanoVenceu && nivel === 1) {
      void salvarProgresso("lig4", 2).then(() => setNivelMax(2));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [situacao]);

  function comecar(escolhido: Modo) {
    feedback("abrir");
    setModo(escolhido);
    setEstado(criarPartida());
  }

  function aoTocarColuna(coluna: number) {
    if (!estado || estado.situacao !== "jogando") return;
    if (modo === "manu" && estado.vez !== 0) return; // vez da Manu
    const proximo = jogar(estado, coluna);
    if (proximo === estado) return;
    tocar("toque");
    setEstado(proximo);
  }

  const confete =
    situacao === "fim" && estado?.vencedor !== null && !(modo === "manu" && estado?.vencedor === 1);

  return (
    <main
      data-modo={modo ?? ""}
      data-nivel={modo === "manu" ? nivel : 0}
      data-semente={semente}
      className="flex h-[100dvh] flex-col overflow-hidden"
    >
      <header className="flex h-16 shrink-0 items-center gap-2 px-2 pt-[env(safe-area-inset-top)] deitado:h-12">
        <Link
          href="/"
          aria-label="voltar para os jogos"
          onPointerDown={() => feedback("toque")}
          className="bolha h-14 min-h-14 w-14 min-w-14 overflow-hidden bg-manu-rosa/40 ring-2 ring-manu-rosa"
        >
          <Mascote pose="rosto" tamanho={56} className="h-14 w-14 object-cover" />
        </Link>
        <h1 className="hidden font-titulo text-xl text-manu-cacau sm:block">Lig-4</h1>
        {modo === "manu" ? (
          <span className="rounded-full bg-manu-ceu-claro px-3 py-1 font-titulo text-sm text-manu-cacau">
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

      {!estado ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-5 px-4">
          <Mascote pose="corpo" tamanho={140} className="h-32 w-auto drop-shadow-md" />
          <p className="text-center font-titulo text-2xl text-manu-cacau">Jogar com quem?</p>
          <div className="flex flex-wrap justify-center gap-4">
            <BotaoBolha rotulo="jogar com alguém" tamanho="xl" onClick={() => comecar("2p")}>
              <span className="px-3 font-titulo text-xl">Com alguém</span>
            </BotaoBolha>
            <BotaoBolha
              rotulo={`jogar ${comAMascote()}`}
              tamanho="xl"
              efeito="abrir"
              onClick={() => comecar("manu")}
              className="bg-manu-sol"
            >
              <span className="px-3 font-titulo text-xl">{`Com ${aMascote()}`}</span>
            </BotaoBolha>
          </div>
          {nivelMax === 2 ? (
            <div className="flex gap-3">
              {([1, 2] as const).map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-label={`nível ${n}`}
                  data-nivel-opcao={n}
                  onClick={() => {
                    feedback("toque");
                    setNivel(n);
                  }}
                  className={`bolha min-h-12 px-4 font-titulo text-lg ${
                    nivel === n
                      ? "bg-manu-sol ring-2 ring-manu-sol-forte"
                      : "bg-manu-papel ring-2 ring-manu-cacau/10"
                  }`}
                >
                  {n === 1 ? "Fácil" : "Difícil"}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div
            data-vez={estado.vez}
            data-situacao={estado.situacao}
            className="flex shrink-0 items-center gap-2"
          >
            <span
              className={`rounded-full px-3 py-1 font-titulo text-sm text-manu-cacau ${
                estado.vez === 0 ? "bg-manu-rosa/60" : "bg-manu-ceu/60"
              }`}
            >
              {estado.situacao === "jogando"
                ? modo === "manu"
                  ? estado.vez === 0
                    ? "Sua vez!"
                    : `${IDENTIDADE.apelido} pensando…`
                  : `Vez: ${NOMES[estado.vez]}`
                : "Fim!"}
            </span>
          </div>

          <div className="grid w-full max-w-[min(94vw,52dvh)] grid-cols-7 gap-1 rounded-2xl bg-manu-ceu/30 p-2 ring-2 ring-manu-ceu deitado:max-w-[min(52dvw,94vh)]">
            {Array.from({ length: COLUNAS }, (_, coluna) => (
              <button
                key={coluna}
                type="button"
                aria-label={`coluna ${coluna + 1}`}
                data-col={coluna}
                disabled={
                  estado.situacao !== "jogando" ||
                  !colunasLegais(estado).includes(coluna) ||
                  (modo === "manu" && estado.vez !== 0)
                }
                onPointerDown={() => feedback("toque")}
                onClick={() => aoTocarColuna(coluna)}
                className="flex min-h-0 flex-col-reverse gap-1 rounded-xl p-0.5 transition-colors active:bg-manu-sol/30"
              >
                {Array.from({ length: LINHAS }, (_, linha) => {
                  const dono = estado.grade[coluna][linha];
                  return (
                    <span
                      key={linha}
                      data-celula={`${coluna}-${linha}`}
                      data-dono={dono ?? ""}
                      className="relative block aspect-square w-full rounded-full bg-manu-papel ring-1 ring-manu-ceu/50"
                    >
                      {dono !== null ? (
                        <span
                          className={`anima-queda absolute inset-0.5 rounded-full shadow-[inset_0_-3px_0_0_rgba(0,0,0,0.15)] ${
                            dono === 0 ? "bg-manu-rosa-forte" : "bg-manu-ceu"
                          }`}
                          style={{ "--queda": `${-44 * (LINHAS - linha)}px` } as React.CSSProperties}
                        />
                      ) : null}
                    </span>
                  );
                })}
              </button>
            ))}
          </div>
        </div>
      )}

      {estado?.situacao === "fim" ? (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-manu-nuvem/95 px-4">
          <Mascote
            pose={modo === "manu" && estado.vencedor === 1 ? "rosto" : "comemorando"}
            tamanho={150}
            className="h-36 w-auto drop-shadow-md"
          />
          <p className="text-center font-titulo text-3xl text-manu-cacau">
            {estado.vencedor === null
              ? "Empatou!"
              : modo === "manu"
                ? estado.vencedor === 0
                  ? "Você venceu!"
                  : `${aMascote().charAt(0).toUpperCase() + aMascote().slice(1)} venceu! Tente de novo`
                : `${NOMES[estado.vencedor]} venceu!`}
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
