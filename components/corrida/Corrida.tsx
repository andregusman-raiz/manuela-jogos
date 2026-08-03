"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { BotaoBolha } from "@/components/ui-kids/BotaoBolha";
import { Confete } from "@/components/ui-kids/Confete";
import { Icone } from "@/components/ui-kids/Icone";
import { Mascote } from "@/components/ui-kids/Mascote";
import { lerProgresso, salvarProgresso } from "@/lib/armazenamento";
import { criarSorte, sementeInicial } from "@/lib/dado";
import {
  SEGMENTO,
  criarCorrida,
  criarOponentes,
  naGrama,
  oponentesNaFrente,
  segmentoEm,
  tick,
} from "@/lib/corrida/motor";
import type { EstadoCorrida, NivelCorrida } from "@/lib/corrida/motor";
import { PISTA_CORRIDA } from "@/lib/corrida/pista";
import { criarLaco } from "@/lib/tempo-real";
import type { LacoTempoReal } from "@/lib/tempo-real";
import { assinarMudo, definirMudo, estaMudo, feedback, mudoNoServidor, tocar } from "@/lib/som";

const HUD_A_CADA = 6; // 10 Hz (SPEC §0.2)
const LINHAS = 40; // segmentos desenhados à frente

type Fase = "menu" | "contagem" | "correndo" | "pausa" | "fim";

const CORES = {
  ceu: "#dcf2f2",
  gramaClara: "#b8dca6",
  gramaEscura: "#a5cf90",
  pista: "#8f8a84",
  pistaEscura: "#86817b",
  zebraA: "#f09bc0",
  zebraB: "#fff9f3",
  faixa: "#fff9f3",
  carro: "#d9739f",
  oponente: "#aedede",
  cacau: "#2e1408",
} as const;

/** Carro cartoon desenhado direto no canvas (arte própria). */
function desenharCarro(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  largura: number,
  cor: string,
) {
  const altura = largura * 0.62;
  ctx.fillStyle = CORES.cacau;
  ctx.fillRect(x - largura * 0.46, y - altura * 0.22, largura * 0.2, altura * 0.26);
  ctx.fillRect(x + largura * 0.26, y - altura * 0.22, largura * 0.2, altura * 0.26);
  ctx.fillStyle = cor;
  ctx.beginPath();
  ctx.roundRect(x - largura / 2, y - altura, largura, altura, largura * 0.16);
  ctx.fill();
  ctx.strokeStyle = CORES.cacau;
  ctx.lineWidth = Math.max(1, largura * 0.04);
  ctx.stroke();
  ctx.fillStyle = "#fff9f3";
  ctx.beginPath();
  ctx.roundRect(x - largura * 0.28, y - altura * 0.92, largura * 0.56, altura * 0.4, largura * 0.1);
  ctx.fill();
}

function desenharQuadro(
  ctx: CanvasRenderingContext2D,
  estado: EstadoCorrida,
  cssL: number,
  cssA: number,
  paralaxe: boolean,
) {
  const horizonte = cssA * 0.32;
  ctx.fillStyle = CORES.ceu;
  ctx.fillRect(0, 0, cssL, horizonte + 2);
  if (paralaxe) {
    // colinas de fundo deslizam devagar com a posição (some no reduced-motion)
    ctx.fillStyle = CORES.gramaEscura;
    const desloca = (estado.posicao / 40) % cssL;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.ellipse(cssL * 0.5 - desloca + i * cssL, horizonte + 6, cssL * 0.7, 26, 0, Math.PI, 0);
      ctx.fill();
    }
  }
  ctx.fillStyle = CORES.gramaClara;
  ctx.fillRect(0, horizonte, cssL, cssA - horizonte);

  const CAM = 1400;
  const base = segmentoEm(estado.segmentos, estado.posicao);
  const fracao = (estado.posicao % SEGMENTO) / SEGMENTO;

  // fronteiras do plano próximo (z≈0, SOB o carro — sem ela a estrada
  // pulsava um vão de grama no rodapé a cada segmento, review PR #57 B2)
  // até LINHAS à frente; curvatura acumula deslocamento horizontal
  const linhas: { y: number; meia: number; centro: number; indice: number }[] = [];
  let curvaAcumulada = 0;
  let derivaCurva = 0;
  for (let n = 0; n <= LINHAS; n++) {
    const indice = Math.min(base + n, estado.segmentos.length - 1);
    const seg = estado.segmentos[indice];
    const z = n === 0 ? 1 : (n - fracao) * SEGMENTO;
    const escala = CAM / (CAM + z);
    const y = horizonte + (cssA - horizonte) * escala - seg.elevacao * escala * 1.4;
    const meia = escala * cssL * 0.52;
    derivaCurva += seg.curva * cssL * 0.0035;
    curvaAcumulada += derivaCurva;
    const centro = cssL / 2 + curvaAcumulada * (1 - escala) - estado.lateral * meia * 0.72;
    linhas.push({ y, meia, centro, indice });
  }

  for (let n = LINHAS; n >= 1; n--) {
    const perto = linhas[n - 1];
    const longe = linhas[n];
    const par = (perto.indice >> 1) % 2 === 0;
    ctx.fillStyle = par ? CORES.gramaClara : CORES.gramaEscura;
    ctx.fillRect(0, longe.y, cssL, Math.max(1, perto.y - longe.y + 1));
    const trapezio = (m1: number, m2: number, cor: string) => {
      ctx.fillStyle = cor;
      ctx.beginPath();
      ctx.moveTo(perto.centro - perto.meia * m1, perto.y);
      ctx.lineTo(perto.centro + perto.meia * m1, perto.y);
      ctx.lineTo(longe.centro + longe.meia * m2, longe.y);
      ctx.lineTo(longe.centro - longe.meia * m2, longe.y);
      ctx.closePath();
      ctx.fill();
    };
    trapezio(1.12, 1.12, par ? CORES.zebraA : CORES.zebraB); // zebra nas bordas
    trapezio(1, 1, par ? CORES.pista : CORES.pistaEscura);
    if (par) trapezio(0.03, 0.03, CORES.faixa); // faixa central tracejada
  }

  // oponentes visíveis: projeção CONTÍNUA interpolando entre fronteiras —
  // arredondar para a linha 1 desenhava um carro ENCOSTADO a 400 u de
  // distância (review PR #57 B3)
  for (const o of estado.oponentes) {
    const delta = o.posicao - estado.posicao;
    if (delta <= 0 || delta > (LINHAS - 1) * SEGMENTO) continue;
    const continua = Math.min(LINHAS - 0.001, delta / SEGMENTO + fracao);
    const k = Math.max(0, Math.min(LINHAS - 1, Math.floor(continua)));
    const t = Math.max(0, continua - k);
    const perto = linhas[k];
    const longe = linhas[k + 1];
    const centro = perto.centro + (longe.centro - perto.centro) * t;
    const meia = perto.meia + (longe.meia - perto.meia) * t;
    const y = perto.y + (longe.y - perto.y) * t;
    desenharCarro(ctx, centro + o.lateral * meia, y, Math.max(10, meia * 0.24), CORES.oponente);
  }

  // carro da criança: fixo no centro-baixo; a PISTA é quem desliza
  desenharCarro(ctx, cssL / 2, cssA - 8, Math.min(cssL * 0.24, 110), CORES.carro);
}

export function Corrida() {
  const [fase, setFase] = useState<Fase>("menu");
  const [nivelMax, setNivelMax] = useState<NivelCorrida>(1);
  const [nivelEscolhido, setNivelEscolhido] = useState<NivelCorrida>(1);
  const [nivelJogo, setNivelJogo] = useState<NivelCorrida>(1);
  const [contagem, setContagem] = useState(3);
  const [estrelas, setEstrelas] = useState(0);
  const [tempoFinal, setTempoFinal] = useState(0);
  const [desbloqueou, setDesbloqueou] = useState(false);
  const [confete, setConfete] = useState(false);
  const [semente, setSemente] = useState(0);
  const mudo = useSyncExternalStore(assinarMudo, estaMudo, mudoNoServidor);

  const estadoRef = useRef<EstadoCorrida | null>(null);
  const faseRef = useRef<Fase>("menu");
  const nivelRef = useRef<NivelCorrida>(1);
  const sementeRef = useRef(0);
  const dedos = useRef<[Set<number>, Set<number>]>([new Set(), new Set()]); // [esquerda, direita]
  const estavaNaGrama = useRef(false);
  const mainRef = useRef<HTMLElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const desdeHud = useRef(0);
  const lacoRef = useRef<LacoTempoReal | null>(null);
  const reduzirMotion = useRef(false);

  useEffect(() => {
    const s = sementeInicial(window.location.search);
    sementeRef.current = s; // síncrono: comecar() nunca depende do setState (lição do Autorama)
    reduzirMotion.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    mainRef.current?.setAttribute("data-ticks", "0"); // §0.2: presente desde o menu
    void lerProgresso("corrida").then((p) => {
      setSemente(s);
      if (p && p.nivel >= 2) setNivelMax(2);
    });
  }, []);

  const publicarHud = useCallback((estado: EstadoCorrida) => {
    desdeHud.current = 0;
    const el = mainRef.current;
    if (!el) return;
    el.setAttribute("data-velocidade", String(Math.round(estado.velocidade)));
    el.setAttribute("data-lateral", estado.lateral.toFixed(2));
    el.setAttribute("data-posicao", String(Math.round(estado.posicao)));
    el.setAttribute("data-tempo", (estado.tempoTicks / 60).toFixed(1));
    el.setAttribute("data-estrelas", String(estado.estrelas));
    el.setAttribute("data-situacao", estado.situacao);
    el.setAttribute("data-frente", String(oponentesNaFrente(estado)));
    el.setAttribute("data-ticks", String(estado.tempoTicks));
  }, []);

  const nivelMaxRef = useRef<NivelCorrida>(1);
  useEffect(() => {
    nivelMaxRef.current = nivelMax;
  }, [nivelMax]);

  const aoFim = useCallback(
    (estado: EstadoCorrida) => {
      lacoRef.current?.parar();
      publicarHud(estado);
      setEstrelas(estado.estrelas);
      setTempoFinal(estado.tempoTicks);
      setFase("fim");
      faseRef.current = "fim";
      tocar("vitoria"); // terminar é festa, sempre
      setConfete(true);
      const nivel = nivelRef.current;
      // terminar o nível 1 abre o 2; `melhor` = MENOR tempo em ticks (min já
      // é a semântica do salvarProgresso)
      void salvarProgresso("corrida", nivel === 1 ? 2 : nivel, estado.tempoTicks).then(() => {
        if (nivel === 1 && nivelMaxRef.current < 2) {
          setNivelMax(2);
          setDesbloqueou(true);
        }
      });
    },
    [publicarHud],
  );

  useEffect(() => {
    const laco = criarLaco({
      aoPasso: () => {
        const estado = estadoRef.current;
        if (!estado || estado.situacao !== "correndo") return;
        const esquerda = dedos.current[0].size > 0;
        const direita = dedos.current[1].size > 0;
        const direcao = esquerda === direita ? 0 : esquerda ? -1 : 1;
        const novo = tick(estado, direcao);
        const grama = naGrama(novo.lateral);
        if (grama && !estavaNaGrama.current) tocar("erro"); // aviso suave, não punição
        estavaNaGrama.current = grama;
        estadoRef.current = novo;
        desdeHud.current += 1;
        if (novo.situacao === "fim") aoFim(novo);
      },
      aoQuadro: () => {
        const estado = estadoRef.current;
        const canvas = canvasRef.current;
        if (!estado || !canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        const dpr = Math.min(window.devicePixelRatio || 1, 2); // §0.2
        const cssL = canvas.clientWidth;
        const cssA = canvas.clientHeight;
        if (canvas.width !== cssL * dpr || canvas.height !== cssA * dpr) {
          canvas.width = cssL * dpr;
          canvas.height = cssA * dpr;
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        desenharQuadro(ctx, estado, cssL, cssA, !reduzirMotion.current);
        if (desdeHud.current >= HUD_A_CADA) publicarHud(estado);
      },
    });
    lacoRef.current = laco;
    return () => laco.parar();
  }, [aoFim, publicarHud]);

  const pausar = useCallback(() => {
    if (faseRef.current !== "correndo" && faseRef.current !== "contagem") return;
    lacoRef.current?.parar();
    dedos.current[0].clear();
    dedos.current[1].clear();
    const estado = estadoRef.current;
    if (estado) {
      estadoRef.current = { ...estado, situacao: "pausa" };
      publicarHud(estadoRef.current);
    }
    setFase("pausa");
    faseRef.current = "pausa";
  }, [publicarHud]);

  useEffect(() => {
    const aoVisibilidade = () => {
      if (document.hidden) pausar();
    };
    document.addEventListener("visibilitychange", aoVisibilidade);
    window.addEventListener("blur", pausar);
    window.addEventListener("pagehide", pausar);
    return () => {
      document.removeEventListener("visibilitychange", aoVisibilidade);
      window.removeEventListener("blur", pausar);
      window.removeEventListener("pagehide", pausar);
    };
  }, [pausar]);

  useEffect(() => {
    if (fase !== "contagem") return;
    const alarme = setTimeout(() => {
      if (contagem > 1) {
        tocar("passo");
        setContagem(contagem - 1);
        return;
      }
      const estado = estadoRef.current;
      if (!estado) return;
      tocar("passo");
      estadoRef.current = { ...estado, situacao: "correndo" };
      setFase("correndo");
      faseRef.current = "correndo";
      publicarHud(estadoRef.current);
      lacoRef.current?.iniciar();
    }, 700);
    return () => clearTimeout(alarme);
  }, [fase, contagem, publicarHud]);

  const comecar = () => {
    const nivel = nivelEscolhido;
    setNivelJogo(nivel);
    nivelRef.current = nivel;
    const oponentes =
      nivel === 2 ? criarOponentes(criarSorte(sementeRef.current)) : [];
    estadoRef.current = criarCorrida(PISTA_CORRIDA, oponentes);
    dedos.current[0].clear();
    dedos.current[1].clear();
    estavaNaGrama.current = false;
    setEstrelas(0);
    setDesbloqueou(false);
    setConfete(false);
    setContagem(3);
    setFase("contagem");
    faseRef.current = "contagem";
    publicarHud(estadoRef.current);
  };

  const retomar = () => {
    const estado = estadoRef.current;
    if (estado) {
      estadoRef.current = { ...estado, situacao: "contagem" };
      publicarHud(estadoRef.current);
    }
    setContagem(3);
    setFase("contagem");
    faseRef.current = "contagem";
  };

  const voltarAoMenu = () => {
    lacoRef.current?.parar();
    estadoRef.current = null;
    setFase("menu");
    faseRef.current = "menu";
  };

  const correndo = fase === "correndo" || fase === "contagem" || fase === "pausa";

  return (
    <main
      ref={mainRef}
      data-semente={semente}
      data-nivel={nivelJogo}
      className="flex h-[100dvh] flex-col overflow-hidden"
    >
      <header className="flex h-16 shrink-0 items-center gap-2 px-2 pt-[env(safe-area-inset-top)] deitado:h-12">
        <Link
          href="/"
          aria-label="voltar para os jogos"
          onPointerDown={() => feedback("toque")}
          className="bolha h-14 min-h-14 w-14 min-w-14 overflow-hidden bg-manu-ceu/50 ring-2 ring-manu-ceu"
        >
          <Mascote pose="rosto" tamanho={56} className="h-14 w-14 object-cover" />
        </Link>
        <h1 className="hidden font-titulo text-xl text-manu-cacau sm:block">Corrida</h1>
        {correndo || fase === "fim" ? (
          <span className="rounded-full bg-manu-ceu/50 px-3 py-1 font-titulo text-sm text-manu-cacau">
            Nível {nivelJogo}
          </span>
        ) : null}
        <div className="ml-auto flex items-center gap-2">
          {fase === "correndo" ? (
            <button
              type="button"
              aria-label="pausa"
              data-pausar
              onClick={pausar}
              className="bolha min-h-14 min-w-14 bg-manu-papel ring-2 ring-manu-cacau/10 font-titulo text-2xl"
            >
              ⏸
            </button>
          ) : null}
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

      {fase === "menu" ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-5 px-4">
          <Mascote pose="corpo" tamanho={140} className="h-32 w-auto drop-shadow-md deitado:h-24" />
          <p className="text-center font-titulo text-2xl text-manu-cacau">Pé na estrada?</p>
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
                  {n === 1 ? "Passeio" : "Com turma"}
                </button>
              ))}
            </div>
          ) : null}
          <BotaoBolha rotulo="começar a corrida" tamanho="xl" onClick={comecar}>
            <span data-largar className="px-6 font-titulo text-2xl">
              Correr! 🛣️
            </span>
          </BotaoBolha>
        </div>
      ) : (
        <div className="relative flex min-h-0 flex-1 flex-col deitado:flex-row">
          <div className="relative min-h-0 flex-1">
            <canvas
              ref={canvasRef}
              data-estrada
              aria-label="estrada da corrida"
              className="h-full w-full"
            />

            {fase === "contagem" ? (
              <div
                data-contagem={contagem}
                aria-live="assertive"
                className="absolute inset-0 flex items-center justify-center"
              >
                <span className="anima-entrada rounded-full bg-manu-papel/90 px-10 py-6 font-titulo text-7xl text-manu-cacau shadow-lg">
                  {contagem}
                </span>
              </div>
            ) : null}

            {fase === "pausa" ? (
              <div
                data-pausa
                aria-live="polite"
                className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-manu-nuvem/85"
              >
                <p className="font-titulo text-3xl text-manu-cacau">Pausa</p>
                <BotaoBolha rotulo="continuar a corrida" tamanho="xl" onClick={retomar}>
                  <span data-continuar className="px-4 font-titulo text-xl">
                    Continuar
                  </span>
                </BotaoBolha>
              </div>
            ) : null}

            {fase === "fim" ? (
              <div
                data-fim
                aria-live="polite"
                className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-manu-nuvem/85 px-4"
              >
                <p className="font-titulo text-4xl" aria-label={`${estrelas} estrelas`}>
                  {"⭐".repeat(estrelas)}
                </p>
                <p className="text-center font-titulo text-3xl text-manu-cacau">
                  Chegou! {(tempoFinal / 60).toFixed(1)}s
                </p>
                {desbloqueou ? (
                  <p className="font-titulo text-xl text-manu-rosa-texto">
                    Nível 2 aberto: a turma chegou! 🎉
                  </p>
                ) : null}
                <div className="flex gap-3">
                  <BotaoBolha rotulo="correr de novo" tamanho="xl" onClick={comecar}>
                    <span data-de-novo className="px-4 font-titulo text-xl">
                      De novo
                    </span>
                  </BotaoBolha>
                  <BotaoBolha rotulo="voltar ao começo" onClick={voltarAoMenu}>
                    <span className="px-3 font-titulo text-lg">Menu</span>
                  </BotaoBolha>
                </div>
              </div>
            ) : null}
          </div>

          <div
            key={fase}
            className="flex shrink-0 gap-3 px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-1 deitado:w-44 deitado:flex-col deitado:pt-3"
          >
            <ZonaVirar indice={0} dedos={dedos} rotulo="virar para a esquerda" simbolo="⬅️" />
            <ZonaVirar indice={1} dedos={dedos} rotulo="virar para a direita" simbolo="➡️" />
          </div>
        </div>
      )}

      <Confete gatilho={confete ? 1 : 0} duracao={1800} />
    </main>
  );
}

/** Zona de toque com conjunto de pointerIds (mesmo contrato do Autorama §1.3). */
function ZonaVirar({
  indice,
  dedos,
  rotulo,
  simbolo,
}: {
  indice: 0 | 1;
  dedos: React.RefObject<[Set<number>, Set<number>]>;
  rotulo: string;
  simbolo: string;
}) {
  const [apertado, setApertado] = useState(false);
  const poe = (e: React.PointerEvent) => {
    try {
      (e.target as Element).releasePointerCapture?.(e.pointerId); // captura implícita do touch
    } catch {
      // sem captura ativa — nada a soltar
    }
    dedos.current[indice].add(e.pointerId);
    setApertado(true);
  };
  const tira = (e: React.PointerEvent) => {
    dedos.current[indice].delete(e.pointerId);
    setApertado(dedos.current[indice].size > 0);
  };
  useEffect(() => {
    const solta = (e: PointerEvent) => {
      dedos.current[indice].delete(e.pointerId);
      setApertado(dedos.current[indice].size > 0);
    };
    window.addEventListener("pointerup", solta);
    window.addEventListener("pointercancel", solta);
    return () => {
      window.removeEventListener("pointerup", solta);
      window.removeEventListener("pointercancel", solta);
    };
  }, [indice, dedos]);
  return (
    <button
      type="button"
      aria-label={rotulo}
      data-zona={indice === 0 ? "esquerda" : "direita"}
      onPointerDown={poe}
      onPointerUp={tira}
      onPointerCancel={tira}
      onPointerLeave={tira}
      onLostPointerCapture={tira}
      onContextMenu={(e) => e.preventDefault()}
      className={`flex min-h-24 flex-1 touch-none select-none items-center justify-center rounded-3xl bg-manu-ceu/60 ring-4 ring-manu-ceu transition-transform ${
        apertado ? "scale-95 brightness-105" : ""
      }`}
    >
      <span aria-hidden className="text-5xl">
        {simbolo}
      </span>
    </button>
  );
}
