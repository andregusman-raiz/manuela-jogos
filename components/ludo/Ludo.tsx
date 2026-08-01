"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { BotaoBolha } from "@/components/ui-kids/BotaoBolha";
import { Confete } from "@/components/ui-kids/Confete";
import { Icone } from "@/components/ui-kids/Icone";
import { Manu } from "@/components/ui-kids/Manu";
import { lerProgresso, salvarProgresso } from "@/lib/armazenamento";
import { criarDado, sementeInicial } from "@/lib/dado";
import {
  CHEGADA,
  ESTRELAS,
  SAIDA,
  criarPartida,
  jogadasLegais,
  mover,
  posicaoGlobal,
  rolar,
} from "@/lib/ludo/motor";
import type { CorLudo, DadoLudo, EstadoLudo, NivelLudo } from "@/lib/ludo/motor";
import {
  BASE_CANTO,
  BASE_SLOTS,
  CENTRO,
  COLUNA_FINAL,
  CORES_LUDO,
  TRILHA,
} from "@/lib/ludo/tabuleiro";
import { assinarMudo, definirMudo, estaMudo, feedback, mudoNoServidor, tocar } from "@/lib/som";

const CEL = 15; // px lógicos por célula (viewBox 225, tabuleiro 15×15)

function centroCelula([col, lin]: readonly [number, number] | readonly number[]): [number, number] {
  return [col * CEL + CEL / 2, lin * CEL + CEL / 2];
}

/** Posição do peão no SVG, com leque quando há pilha na mesma casa. */
function posicaoPeao(
  estado: EstadoLudo,
  indice: number,
): [number, number] {
  const peao = estado.peoes[indice];
  if (peao.progresso === -1) {
    return centroCelula(BASE_SLOTS[peao.cor][peao.indice]);
  }
  if (peao.progresso === CHEGADA) {
    const [cx, cy] = centroCelula(CENTRO);
    return [cx + (peao.indice % 2) * 8 - 4, cy + Math.floor(peao.indice / 2) * 8 - 4];
  }
  const celula =
    peao.progresso <= 50
      ? TRILHA[posicaoGlobal(peao)!]
      : COLUNA_FINAL[peao.cor][peao.progresso - 51];
  const [cx, cy] = centroCelula(celula);
  // leque: irmãos de casa se afastam um tiquinho para todos aparecerem
  const irmaos = estado.peoes.filter(
    (p, i) =>
      i !== indice &&
      p.progresso === peao.progresso &&
      (p.progresso > 50 ? p.cor === peao.cor : posicaoGlobal(p) === posicaoGlobal(peao)),
  ).length;
  if (irmaos === 0) return [cx, cy];
  const meu = estado.peoes.slice(0, indice).filter(
    (p) => p.progresso === peao.progresso && posicaoGlobal(p) === posicaoGlobal(peao),
  ).length;
  return [cx + meu * 4 - (irmaos * 4) / 2, cy - meu * 2];
}

export function Ludo() {
  const [estado, setEstado] = useState<EstadoLudo | null>(null);
  const [nivelMax, setNivelMax] = useState<NivelLudo>(1);
  const [nivelEscolhido, setNivelEscolhido] = useState<NivelLudo>(1);
  const [dadoGirando, setDadoGirando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [semente, setSemente] = useState(0);
  const dado = useRef<(() => DadoLudo) | null>(null);
  const mudo = useSyncExternalStore(assinarMudo, estaMudo, mudoNoServidor);

  useEffect(() => {
    const s = sementeInicial(window.location.search);
    dado.current = criarDado(s);
    void lerProgresso("ludo").then((p) => {
      setSemente(s);
      setNivelMax(Math.min(p?.nivel ?? 1, 2) as NivelLudo);
    });
  }, []);

  const situacao = estado?.situacao;
  const legais = estado ? jogadasLegais(estado) : [];

  // auto-move: uma única jogada legal anda sozinha (SPEC §1.2 — timer é da UI)
  useEffect(() => {
    if (!estado || situacao !== "mover") return;
    const unicas = jogadasLegais(estado);
    if (unicas.length !== 1) return;
    const t = setTimeout(() => aplicarMovimento(unicas[0]), 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado]);

  useEffect(() => {
    if (situacao !== "fim" || !estado) return;
    tocar("vitoria");
    if (estado.nivel === 1) {
      void salvarProgresso("ludo", 2).then(() => setNivelMax(2));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [situacao]);

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), 900);
    return () => clearTimeout(t);
  }, [aviso]);

  function comecar(jogadores: 2 | 3 | 4) {
    feedback("abrir");
    setEstado(criarPartida(jogadores, nivelEscolhido));
  }

  function aoRolar() {
    if (!estado || estado.situacao !== "rolar" || dadoGirando || !dado.current) return;
    feedback("toque");
    tocar("passo");
    const d6 = dado.current();
    setDadoGirando(true);
    setTimeout(() => {
      setDadoGirando(false);
      setEstado((atual) => {
        if (!atual || atual.situacao !== "rolar") return atual;
        const proximo = rolar(atual, d6);
        if (proximo.situacao === "rolar") {
          // rolou e não pôde jogar (ou 3º seis) — avisa e a vez já passou
          setAviso(
            atual.nivel === 2 && d6 === 6 && atual.seisSeguidos === 2
              ? "Três 6! Passou a vez"
              : "Sem jogada — passou a vez",
          );
        }
        return proximo;
      });
    }, 400);
  }

  function aplicarMovimento(indice: number) {
    if (!estado) return;
    const proximo = mover(estado, indice);
    if (proximo === estado) return;
    const capturado = proximo.peoes.some(
      (p, i) => p.progresso === -1 && estado.peoes[i].progresso >= 0,
    );
    const chegou = proximo.peoes[indice].progresso === CHEGADA;
    tocar(capturado ? "erro" : chegou ? "acerto" : "toque");
    setEstado(proximo);
  }

  function aoTocarPeao(indice: number) {
    if (!estado || estado.situacao !== "mover") return;
    if (!jogadasLegais(estado).includes(indice)) return;
    feedback("toque");
    aplicarMovimento(indice);
  }

  const vezInfo = estado ? CORES_LUDO[estado.vez] : null;

  return (
    <main
      data-nivel={estado?.nivel ?? 0}
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
          <Manu pose="rosto" tamanho={56} className="h-14 w-14 object-cover" />
        </Link>
        <h1 className="hidden font-titulo text-xl text-manu-cacau sm:block">Ludo da Manu</h1>
        {estado ? (
          <span className="rounded-full bg-manu-rosa/40 px-3 py-1 font-titulo text-sm text-manu-cacau">
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

      {!estado ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-5 px-4">
          <Manu pose="corpo" tamanho={140} className="h-32 w-auto drop-shadow-md" />
          <p className="text-center font-titulo text-2xl text-manu-cacau">Quem vai jogar?</p>
          <div className="flex gap-4">
            {([2, 3, 4] as const).map((n) => (
              <BotaoBolha key={n} rotulo={`${n} jogadores`} tamanho="xl" onClick={() => comecar(n)}>
                <span className="px-4 font-titulo text-3xl">{n}</span>
              </BotaoBolha>
            ))}
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
                    setNivelEscolhido(n);
                  }}
                  className={`bolha min-h-12 px-4 font-titulo text-lg ${
                    nivelEscolhido === n
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
        <div className="flex min-h-0 flex-1 flex-col deitado:flex-row">
          <div className="relative flex min-h-0 flex-1 items-center justify-center px-2">
            <svg
              viewBox="0 0 225 225"
              role="img"
              aria-label="tabuleiro de ludo"
              className="h-full max-h-full w-auto max-w-full"
            >
              {/* bases */}
              {([0, 1, 2, 3] as const).slice(0, estado.jogadores).map((c) => {
                const [bx, by] = BASE_CANTO[c];
                return (
                  <rect
                    key={`base-${c}`}
                    x={bx * CEL + 3}
                    y={by * CEL + 3}
                    width={6 * CEL - 6}
                    height={6 * CEL - 6}
                    rx={12}
                    fill={CORES_LUDO[c].pele}
                    opacity={0.35}
                    stroke={CORES_LUDO[c].borda}
                    strokeWidth={0.8}
                  />
                );
              })}
              {/* trilha */}
              {TRILHA.map(([col, lin], g) => {
                const saidaDe = SAIDA.indexOf(g);
                const estrela = ESTRELAS.includes(g);
                return (
                  <g key={`casa-${g}`}>
                    <rect
                      x={col * CEL + 0.8}
                      y={lin * CEL + 0.8}
                      width={CEL - 1.6}
                      height={CEL - 1.6}
                      rx={3}
                      fill={saidaDe >= 0 ? CORES_LUDO[saidaDe as CorLudo].pele : "#fff9f3"}
                      opacity={saidaDe >= 0 ? 0.8 : 1}
                      stroke="#c9b8a8"
                      strokeWidth={0.5}
                    />
                    {estrela ? (
                      <text
                        x={col * CEL + CEL / 2}
                        y={lin * CEL + CEL / 2 + 3}
                        textAnchor="middle"
                        fontSize={8}
                        opacity={0.7}
                        pointerEvents="none"
                      >
                        ⭐
                      </text>
                    ) : null}
                  </g>
                );
              })}
              {/* colunas finais */}
              {([0, 1, 2, 3] as const).map((c) =>
                COLUNA_FINAL[c].map(([col, lin], i) => (
                  <rect
                    key={`final-${c}-${i}`}
                    x={col * CEL + 0.8}
                    y={lin * CEL + 0.8}
                    width={CEL - 1.6}
                    height={CEL - 1.6}
                    rx={3}
                    fill={CORES_LUDO[c].pele}
                    opacity={0.55}
                    stroke={CORES_LUDO[c].borda}
                    strokeWidth={0.4}
                  />
                )),
              )}
              {/* centro (chegada) */}
              <rect
                x={6 * CEL + 2}
                y={6 * CEL + 2}
                width={3 * CEL - 4}
                height={3 * CEL - 4}
                rx={8}
                fill="#f8de7b"
                stroke="#a8842a"
                strokeWidth={1}
              />
              <text
                x={centroCelula(CENTRO)[0]}
                y={centroCelula(CENTRO)[1] + 4}
                textAnchor="middle"
                fontSize={11}
                pointerEvents="none"
              >
                🏆
              </text>
              {/* peões */}
              {estado.peoes.map((peao, indice) => {
                const [px, py] = posicaoPeao(estado, indice);
                const legal = legais.includes(indice);
                const area =
                  peao.progresso === -1
                    ? "base"
                    : peao.progresso === CHEGADA
                      ? "chegada"
                      : peao.progresso > 50
                        ? "coluna"
                        : "volta";
                return (
                  <g key={`${peao.cor}-${peao.indice}`}>
                    {legal ? (
                      <circle cx={px} cy={py} r={9} fill="none" stroke="#a8842a" strokeWidth={1.4} strokeDasharray="3 2" className="anima-brilho" />
                    ) : null}
                    <circle
                      data-peao={`${peao.cor}-${peao.indice}`}
                      data-progresso={peao.progresso}
                      data-area={area}
                      data-legal={legal ? "true" : "false"}
                      cx={px}
                      cy={py}
                      r={6.2}
                      fill={CORES_LUDO[peao.cor].pele}
                      stroke={CORES_LUDO[peao.cor].borda}
                      strokeWidth={1.4}
                      onPointerDown={() => {
                        if (legal) feedback("toque");
                      }}
                      onClick={() => aoTocarPeao(indice)}
                    />
                  </g>
                );
              })}
            </svg>
            {aviso ? (
              <p
                data-aviso="true"
                className="anima-entrada absolute bottom-2 rounded-full bg-manu-cacau/80 px-4 py-1 font-titulo text-sm text-white"
              >
                {aviso}
              </p>
            ) : null}
          </div>

          {/* barra da vez: dado + chips de jogada (alvos ≥44px de verdade) */}
          <div
            data-vez={estado.vez}
            data-situacao={estado.situacao}
            data-dado={estado.dado ?? ""}
            className="flex shrink-0 items-center justify-center gap-3 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-1 deitado:h-full deitado:flex-col deitado:justify-center deitado:pb-2"
          >
            {vezInfo && estado.situacao !== "fim" ? (
              <span
                className="rounded-full px-3 py-1 font-titulo text-sm"
                style={{ backgroundColor: vezInfo.pele, color: "#2e1408" }}
              >
                Vez: {vezInfo.nome}
              </span>
            ) : null}
            <button
              type="button"
              aria-label="rolar o dado"
              data-dado-botao="true"
              disabled={estado.situacao !== "rolar" || dadoGirando}
              onClick={aoRolar}
              className={`bolha min-h-16 min-w-16 font-titulo text-3xl ring-2 ${
                estado.situacao === "rolar"
                  ? "bg-manu-papel ring-manu-sol-forte"
                  : "bg-manu-papel opacity-50 ring-manu-cacau/10"
              } ${dadoGirando ? "anima-brilho" : ""}`}
            >
              {dadoGirando ? "🎲" : (estado.dado ?? "🎲")}
            </button>
            {estado.situacao === "mover" && legais.length >= 2
              ? legais.map((indice) => {
                  const peao = estado.peoes[indice];
                  return (
                    <button
                      key={indice}
                      type="button"
                      aria-label={`mover peão ${peao.indice + 1}`}
                      data-chip={`${peao.cor}-${peao.indice}`}
                      onPointerDown={() => feedback("toque")}
                      onClick={() => aoTocarPeao(indice)}
                      className="bolha min-h-14 min-w-14 font-titulo text-lg ring-2"
                      style={{
                        backgroundColor: CORES_LUDO[peao.cor].pele,
                        borderColor: CORES_LUDO[peao.cor].borda,
                      }}
                    >
                      {peao.indice + 1}
                    </button>
                  );
                })
              : null}
          </div>
        </div>
      )}

      {estado?.situacao === "fim" && estado.vencedor !== null ? (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-manu-nuvem/95 px-4">
          <Manu pose="comemorando" tamanho={150} className="h-36 w-auto drop-shadow-md" />
          <p className="text-center font-titulo text-3xl text-manu-cacau">
            {CORES_LUDO[estado.vencedor].nome} venceu!
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <BotaoBolha
              rotulo="jogar de novo"
              tamanho="xl"
              onClick={() => {
                setEstado(null);
              }}
            >
              <span className="px-3 font-titulo text-2xl">De novo</span>
            </BotaoBolha>
          </div>
        </div>
      ) : null}

      <Confete gatilho={situacao === "fim" ? 1 : 0} duracao={1800} />
    </main>
  );
}
