"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { BotaoBolha } from "@/components/ui-kids/BotaoBolha";
import { Confete } from "@/components/ui-kids/Confete";
import { Icone } from "@/components/ui-kids/Icone";
import { Manu } from "@/components/ui-kids/Manu";
import { salvarProgresso } from "@/lib/armazenamento";
import { COBRAS, ESCADAS, aplicarDado, criarPartida, jogar } from "@/lib/cobras/motor";
import type { DadoCobras, EstadoCobras } from "@/lib/cobras/motor";
import { CEL, celulaDaCasa, centroDaCasa } from "@/lib/cobras/tabuleiro";
import { criarDado, sementeInicial } from "@/lib/dado";
import { CORES_LUDO } from "@/lib/ludo/tabuleiro";
import { assinarMudo, definirMudo, estaMudo, feedback, mudoNoServidor, tocar } from "@/lib/som";

interface Animacao {
  jogador: number;
  passos: number[]; // casas visitadas; o último pode ser o salto do atalho
  indice: number;
  atalho: "cobra" | "escada" | null;
  proximo: EstadoCobras;
}

export function Cobras() {
  const [estado, setEstado] = useState<EstadoCobras | null>(null);
  const [animacao, setAnimacao] = useState<Animacao | null>(null);
  const [dadoGirando, setDadoGirando] = useState(false);
  const [semente, setSemente] = useState(0);
  const dado = useRef<(() => DadoCobras) | null>(null);
  const mudo = useSyncExternalStore(assinarMudo, estaMudo, mudoNoServidor);

  useEffect(() => {
    const s = sementeInicial(window.location.search);
    dado.current = criarDado(s);
    // sem progresso para carregar: Cobras não tem níveis
    const t = setTimeout(() => setSemente(s), 0);
    return () => clearTimeout(t);
  }, []);

  const situacao = estado?.situacao;

  // anda uma casa por vez; o passo do atalho é mais lento e tem som próprio
  useEffect(() => {
    if (!animacao) return;
    const ultimo = animacao.indice === animacao.passos.length - 1;
    const passoDeAtalho = ultimo && animacao.atalho !== null;
    const t = setTimeout(
      () => {
        if (animacao.indice < animacao.passos.length - 1) {
          const proximoIndice = animacao.indice + 1;
          const seraAtalho =
            proximoIndice === animacao.passos.length - 1 && animacao.atalho !== null;
          tocar(seraAtalho ? (animacao.atalho === "escada" ? "cor" : "erro") : "passo");
          setAnimacao({ ...animacao, indice: proximoIndice });
        } else {
          setEstado(animacao.proximo);
          setAnimacao(null);
        }
      },
      passoDeAtalho ? 420 : 120,
    );
    return () => clearTimeout(t);
  }, [animacao]);

  useEffect(() => {
    if (situacao !== "fim") return;
    tocar("vitoria");
    void salvarProgresso("cobras", 1);
  }, [situacao]);

  function comecar(jogadores: 2 | 3 | 4) {
    feedback("abrir");
    setEstado(criarPartida(jogadores));
  }

  function aoRolar() {
    if (!estado || estado.situacao !== "jogando" || dadoGirando || animacao || !dado.current)
      return;
    feedback("toque");
    tocar("passo");
    const d6 = dado.current();
    setDadoGirando(true);
    setTimeout(() => {
      setDadoGirando(false);
      const jogada = aplicarDado(estado.posicoes[estado.vez], d6);
      const proximo = jogar(estado, d6);
      const passos =
        jogada.atalho === null ? jogada.caminho : [...jogada.caminho, jogada.destino];
      setAnimacao({
        jogador: estado.vez,
        passos,
        indice: 0,
        atalho: jogada.atalho,
        proximo,
      });
    }, 400);
  }

  /** Posição EXIBIDA (a animação manda no peão que está andando). */
  function posicaoExibida(jogador: number): number {
    if (animacao && animacao.jogador === jogador) return animacao.passos[animacao.indice];
    return estado?.posicoes[jogador] ?? 0;
  }

  const vezInfo = estado ? CORES_LUDO[estado.vez as 0 | 1 | 2 | 3] : null;

  return (
    <main data-semente={semente} className="flex h-[100dvh] flex-col overflow-hidden">
      <header className="flex h-16 shrink-0 items-center gap-2 px-2 pt-[env(safe-area-inset-top)] deitado:h-12">
        <Link
          href="/"
          aria-label="voltar para os jogos"
          onPointerDown={() => feedback("toque")}
          className="bolha h-14 min-h-14 w-14 min-w-14 overflow-hidden bg-manu-rosa/40 ring-2 ring-manu-rosa"
        >
          <Manu pose="rosto" tamanho={56} className="h-14 w-14 object-cover" />
        </Link>
        <h1 className="hidden font-titulo text-xl text-manu-cacau sm:block">Cobras e Escadas</h1>
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
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col deitado:flex-row">
          <div className="relative flex min-h-0 flex-1 items-center justify-center px-2">
            <svg
              viewBox="0 0 200 200"
              role="img"
              aria-label="tabuleiro de cobras e escadas"
              className="h-full max-h-full w-auto max-w-full"
            >
              {/* casas numeradas */}
              {Array.from({ length: 100 }, (_, i) => i + 1).map((casa) => {
                const [col, lin] = celulaDaCasa(casa);
                const linhaPar = (9 - lin) % 2 === 1;
                return (
                  <g key={casa}>
                    <rect
                      data-casa={casa}
                      x={col * CEL + 0.5}
                      y={lin * CEL + 0.5}
                      width={CEL - 1}
                      height={CEL - 1}
                      rx={2}
                      fill={linhaPar ? "#fdf3e2" : "#fff9f3"}
                      stroke="#e2d4c3"
                      strokeWidth={0.5}
                    />
                    <text
                      x={col * CEL + CEL / 2}
                      y={lin * CEL + CEL / 2 + 3.2}
                      textAnchor="middle"
                      fontSize={8}
                      fontWeight={casa === 100 ? 800 : 500}
                      fill={casa === 100 ? "#a8842a" : "#6b4630"}
                      pointerEvents="none"
                    >
                      {casa}
                    </text>
                  </g>
                );
              })}
              {/* escadas: trilho duplo verde */}
              {Object.entries(ESCADAS).map(([de, para]) => {
                const [x1, y1] = centroDaCasa(Number(de));
                const [x2, y2] = centroDaCasa(para);
                const dx = x2 - x1;
                const dy = y2 - y1;
                const norma = Math.hypot(dx, dy);
                const ox = (-dy / norma) * 2.2;
                const oy = (dx / norma) * 2.2;
                return (
                  <g key={`escada-${de}`} opacity={0.75} pointerEvents="none">
                    <line x1={x1 + ox} y1={y1 + oy} x2={x2 + ox} y2={y2 + oy} stroke="#4f8a44" strokeWidth={1.6} strokeLinecap="round" />
                    <line x1={x1 - ox} y1={y1 - oy} x2={x2 - ox} y2={y2 - oy} stroke="#4f8a44" strokeWidth={1.6} strokeLinecap="round" />
                    {Array.from({ length: 4 }, (_, i) => {
                      const t = (i + 1) / 5;
                      const cx = x1 + dx * t;
                      const cy = y1 + dy * t;
                      return (
                        <line key={i} x1={cx + ox} y1={cy + oy} x2={cx - ox} y2={cy - oy} stroke="#4f8a44" strokeWidth={1.2} />
                      );
                    })}
                  </g>
                );
              })}
              {/* cobras: curva rosa com cabecinha */}
              {Object.entries(COBRAS).map(([de, para]) => {
                const [x1, y1] = centroDaCasa(Number(de));
                const [x2, y2] = centroDaCasa(para);
                const mx = (x1 + x2) / 2 + (y2 - y1) * 0.18;
                const my = (y1 + y2) / 2 + (x1 - x2) * 0.18;
                return (
                  <g key={`cobra-${de}`} opacity={0.8} pointerEvents="none">
                    <path
                      d={`M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`}
                      fill="none"
                      stroke="#b34f80"
                      strokeWidth={2.4}
                      strokeLinecap="round"
                    />
                    <circle cx={x1} cy={y1} r={2.6} fill="#b34f80" />
                  </g>
                );
              })}
              {/* peões */}
              {estado.posicoes.map((_, jogador) => {
                const pos = posicaoExibida(jogador);
                const cor = CORES_LUDO[jogador as 0 | 1 | 2 | 3];
                const naMesma = estado.posicoes.filter(
                  (__, j) => posicaoExibida(j) === pos && j < jogador,
                ).length;
                const [cx, cy] =
                  pos === 0
                    ? [8 + jogador * 12, 196]
                    : centroDaCasa(pos);
                return (
                  <g key={jogador}>
                    <circle
                      data-peao={jogador}
                      data-pos={pos}
                      cx={pos === 0 ? cx : cx + naMesma * 3.5 - 1.75}
                      cy={pos === 0 ? cy : cy - naMesma * 2 + 4.5}
                      r={4.6}
                      fill={cor.pele}
                      stroke={cor.borda}
                      strokeWidth={1.2}
                    />
                  </g>
                );
              })}
            </svg>
          </div>

          <div
            data-vez={estado.vez}
            data-situacao={estado.situacao}
            data-dado={estado.dado ?? ""}
            data-animando={animacao ? "true" : "false"}
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
              disabled={estado.situacao !== "jogando" || dadoGirando || animacao !== null}
              onClick={aoRolar}
              className={`bolha min-h-16 min-w-16 font-titulo text-3xl ring-2 ${
                estado.situacao === "jogando" && !animacao
                  ? "bg-manu-papel ring-manu-sol-forte"
                  : "bg-manu-papel opacity-50 ring-manu-cacau/10"
              } ${dadoGirando ? "anima-brilho" : ""}`}
            >
              {dadoGirando ? "🎲" : (estado.dado ?? "🎲")}
            </button>
          </div>
        </div>
      )}

      {estado?.situacao === "fim" && estado.vencedor !== null ? (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-manu-nuvem/95 px-4">
          <Manu pose="comemorando" tamanho={150} className="h-36 w-auto drop-shadow-md" />
          <p className="text-center font-titulo text-3xl text-manu-cacau">
            {CORES_LUDO[estado.vencedor as 0 | 1 | 2 | 3].nome} chegou no 100!
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <BotaoBolha rotulo="jogar de novo" tamanho="xl" onClick={() => setEstado(null)}>
              <span className="px-3 font-titulo text-2xl">De novo</span>
            </BotaoBolha>
          </div>
        </div>
      ) : null}

      {/* anel da vez, como no Ludo */}
      {estado && estado.situacao !== "fim" ? (
        <div
          aria-hidden
          data-anel-vez={estado.vez}
          className="pointer-events-none absolute inset-0 border-4 transition-colors"
          style={{ borderColor: CORES_LUDO[estado.vez as 0 | 1 | 2 | 3].pele }}
        />
      ) : null}

      <Confete gatilho={situacao === "fim" ? 1 : 0} duracao={1800} />
    </main>
  );
}
