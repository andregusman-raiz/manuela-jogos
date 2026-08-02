"use client";

import Link from "next/link";
import { IDENTIDADE, aMascote, comAMascote } from "@/lib/identidade";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { BotaoBolha } from "@/components/ui-kids/BotaoBolha";
import { Confete } from "@/components/ui-kids/Confete";
import { Icone } from "@/components/ui-kids/Icone";
import { Mascote } from "@/components/ui-kids/Mascote";
import { salvarProgresso } from "@/lib/armazenamento";
import { criarSorte, sementeInicial } from "@/lib/dado";
import {
  adjacentes,
  aplicar,
  colocar,
  criarPartida,
  faseDe,
  iaJogarRota,
  moverPeca,
} from "@/lib/rota/motor";
import type { EstadoRota } from "@/lib/rota/motor";
import { assinarMudo, definirMudo, estaMudo, feedback, mudoNoServidor, tocar } from "@/lib/som";

type ModoRota = "2p" | "manu";

const NOMES = ["Rosa", "Azul"] as const;
const CORES = ["#f09bc0", "#8fd0d9"] as const;
const BORDAS = ["#b34f80", "#3f7f8c"] as const;

/** Casa 0..7 no anel (começando no topo, sentido horário) + 8 no centro. */
function centroDaCasa(casa: number): [number, number] {
  if (casa === 8) return [100, 100];
  const angulo = (casa * 45 - 90) * (Math.PI / 180);
  return [100 + 72 * Math.cos(angulo), 100 + 72 * Math.sin(angulo)];
}

export function Rota() {
  const [modo, setModo] = useState<ModoRota | null>(null);
  const [estado, setEstado] = useState<EstadoRota | null>(null);
  const [selecionada, setSelecionada] = useState<number | null>(null);
  const sorte = useRef<(() => number) | null>(null);
  const mudo = useSyncExternalStore(assinarMudo, estaMudo, mudoNoServidor);

  useEffect(() => {
    sorte.current = criarSorte(sementeInicial(window.location.search));
  }, []);

  const situacao = estado?.situacao;

  // vez da Manu
  useEffect(() => {
    if (!estado || modo !== "manu" || estado.situacao !== "jogando" || estado.vez !== 1) return;
    const t = setTimeout(() => {
      if (!sorte.current) return;
      tocar("toque");
      setEstado(aplicar(estado, iaJogarRota(estado, sorte.current)));
    }, 700);
    return () => clearTimeout(t);
  }, [estado, modo]);

  useEffect(() => {
    if (!estado || situacao === "jogando" || situacao === undefined) return;
    const humanoPerdeu = modo === "manu" && estado.vencedor === 1;
    tocar(situacao === "empate" ? "passo" : humanoPerdeu ? "erro" : "vitoria");
    void salvarProgresso("rota", 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [situacao]);

  function comecar(escolhido: ModoRota) {
    feedback("abrir");
    setModo(escolhido);
    setEstado(criarPartida());
    setSelecionada(null);
  }

  function aoTocarCasa(casa: number) {
    if (!estado || estado.situacao !== "jogando") return;
    if (modo === "manu" && estado.vez !== 0) return;

    if (faseDe(estado) === "colocacao") {
      const proximo = colocar(estado, casa);
      if (proximo === estado) return;
      tocar("toque");
      setEstado(proximo);
      return;
    }
    // movimento: primeiro escolhe a peça, depois o destino adjacente vazio
    if (estado.casas[casa] === estado.vez) {
      feedback("toque");
      setSelecionada(casa === selecionada ? null : casa);
      return;
    }
    if (selecionada !== null && estado.casas[casa] === null) {
      const proximo = moverPeca(estado, selecionada, casa);
      if (proximo === estado) return;
      tocar("toque");
      setSelecionada(null);
      setEstado(proximo);
    }
  }

  const destinosLegais =
    estado && selecionada !== null && faseDe(estado) === "movimento"
      ? adjacentes(selecionada).filter((c) => estado.casas[c] === null)
      : [];
  const colocando = estado ? faseDe(estado) === "colocacao" : false;
  const confete =
    situacao === "fim" && !(modo === "manu" && estado?.vencedor === 1);

  return (
    <main data-modo={modo ?? ""} className="flex h-[100dvh] flex-col overflow-hidden">
      <header className="flex h-16 shrink-0 items-center gap-2 px-2 pt-[env(safe-area-inset-top)] deitado:h-12">
        <Link
          href="/"
          aria-label="voltar para os jogos"
          onPointerDown={() => feedback("toque")}
          className="bolha h-14 min-h-14 w-14 min-w-14 overflow-hidden bg-manu-rosa/40 ring-2 ring-manu-rosa"
        >
          <Mascote pose="rosto" tamanho={56} className="h-14 w-14 object-cover" />
        </Link>
        <h1 className="hidden font-titulo text-xl text-manu-cacau sm:block">Roda Romana</h1>
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
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-1 px-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div
            data-vez={estado.vez}
            data-situacao={estado.situacao}
            data-fase={faseDe(estado)}
            className={`shrink-0 rounded-full px-3 py-1 font-titulo text-sm text-manu-cacau ${
              estado.vez === 0 ? "bg-manu-rosa/60" : "bg-manu-ceu/60"
            }`}
          >
            {estado.situacao !== "jogando"
              ? "Fim!"
              : modo === "manu"
                ? estado.vez === 0
                  ? colocando
                    ? "Coloque uma peça rosa"
                    : "Mova uma peça rosa"
                  : `${IDENTIDADE.apelido} pensando…`
                : `Vez: ${NOMES[estado.vez]} — ${colocando ? "colocar" : "mover"}`}
          </div>

          <svg
            viewBox="0 0 200 200"
            role="img"
            aria-label="roda romana"
            className="h-full max-h-full w-auto max-w-full"
          >
            {/* aro e raios */}
            <circle cx={100} cy={100} r={72} fill="none" stroke="#c9b8a8" strokeWidth={2} />
            {[0, 1, 2, 3].map((i) => {
              const [x1, y1] = centroDaCasa(i);
              const [x2, y2] = centroDaCasa(i + 4);
              return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#c9b8a8" strokeWidth={1.4} />;
            })}
            {/* casas */}
            {Array.from({ length: 9 }, (_, casa) => {
              const [cx, cy] = centroDaCasa(casa);
              const dono = estado.casas[casa];
              const legalDestino = destinosLegais.includes(casa);
              const legalColocar = colocando && dono === null && estado.situacao === "jogando";
              return (
                <g key={casa}>
                  {legalDestino || (legalColocar && (modo === "2p" || estado.vez === 0)) ? (
                    <circle cx={cx} cy={cy} r={20.5} fill="none" stroke="#a8842a" strokeWidth={1.6} strokeDasharray="4 3" className="anima-brilho" />
                  ) : null}
                  <circle
                    data-casa={casa}
                    data-dono={dono ?? ""}
                    data-selecionada={selecionada === casa ? "true" : "false"}
                    cx={cx}
                    cy={cy}
                    r={16.5}
                    fill={dono === null ? "#fff9f3" : CORES[dono]}
                    stroke={
                      selecionada === casa ? "#a8842a" : dono === null ? "#c9b8a8" : BORDAS[dono]
                    }
                    strokeWidth={selecionada === casa ? 3 : 1.6}
                    onPointerDown={() => feedback("toque")}
                    onClick={() => aoTocarCasa(casa)}
                  />
                </g>
              );
            })}
          </svg>
        </div>
      )}

      {estado && estado.situacao !== "jogando" ? (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-manu-nuvem/95 px-4">
          <Mascote
            pose={modo === "manu" && estado.vencedor === 1 ? "rosto" : "comemorando"}
            tamanho={150}
            className="h-36 w-auto drop-shadow-md"
          />
          <p className="text-center font-titulo text-3xl text-manu-cacau">
            {estado.situacao === "empate"
              ? "Empatou! A roda girou, girou…"
              : modo === "manu"
                ? estado.vencedor === 0
                  ? "Você venceu!"
                  : `${aMascote().charAt(0).toUpperCase() + aMascote().slice(1)} venceu! Tente de novo`
                : `${NOMES[estado.vencedor!]} venceu!`}
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
