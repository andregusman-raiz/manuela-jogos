"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { BotaoBolha } from "@/components/ui-kids/BotaoBolha";
import { Confete } from "@/components/ui-kids/Confete";
import { Icone } from "@/components/ui-kids/Icone";
import { Mascote } from "@/components/ui-kids/Mascote";
import { lerProgresso, salvarProgresso } from "@/lib/armazenamento";
import { criarSorte, sementeInicial } from "@/lib/dado";
import { aMascote } from "@/lib/identidade";
import { useIdentidade } from "@/lib/usePerfil";
import {
  PISTAS,
  SPIN_TICKS,
  criarIa,
  criarPartida,
  entradaIa,
  tick,
  trechoEm,
} from "@/lib/autorama/motor";
import type { EstadoAutorama, IaAutorama, NivelAutorama } from "@/lib/autorama/motor";
import { pontoNoTrilho, pontosDaLinha, viewBoxDoTrilho } from "@/lib/autorama/trilho";
import { criarLaco } from "@/lib/tempo-real";
import type { LacoTempoReal } from "@/lib/tempo-real";
import { assinarMudo, definirMudo, estaMudo, feedback, mudoNoServidor, tocar } from "@/lib/som";

const HUD_A_CADA = 6; // 10 Hz (SPEC §0.2)
const SLOT = 2.5; // deslocamento perpendicular de cada pista do trilho (vu)

type Modo = "manu" | "2p";
type Fase = "menu" | "contagem" | "correndo" | "pausa" | "fim";

/** Cores dos carros/botões por índice (0 = criança, 1 = mascote/jogador 2). */
const CARROS = [
  { corpo: "var(--color-manu-rosa-forte)", botao: "bg-manu-rosa/60 ring-manu-rosa-forte" },
  { corpo: "var(--color-manu-ceu)", botao: "bg-manu-ceu/60 ring-manu-ceu" },
] as const;

/**
 * Botão de acelerar por CONJUNTO de pointerIds (SPEC §1.3): pressionado
 * enquanto houver qualquer dedo no botão; escorregar para fora = soltar.
 */
function BotaoAcelerar({
  indice,
  dedos,
  rotulo,
  className,
}: {
  indice: 0 | 1;
  dedos: React.RefObject<[Set<number>, Set<number>]>;
  rotulo: string;
  className: string;
}) {
  const [apertado, setApertado] = useState(false);
  const poe = (e: React.PointerEvent) => {
    dedos.current[indice].add(e.pointerId);
    setApertado(true);
  };
  const tira = (e: React.PointerEvent) => {
    dedos.current[indice].delete(e.pointerId);
    setApertado(dedos.current[indice].size > 0);
  };
  return (
    <button
      type="button"
      aria-label={rotulo}
      data-acelerar={indice}
      onPointerDown={poe}
      onPointerUp={tira}
      onPointerCancel={tira}
      onPointerLeave={tira}
      onLostPointerCapture={tira}
      onContextMenu={(e) => e.preventDefault()}
      className={`flex min-h-24 flex-1 touch-none select-none items-center justify-center rounded-3xl ring-4 transition-transform ${className} ${
        apertado ? "scale-95 brightness-105" : ""
      }`}
    >
      <span aria-hidden className="text-5xl">
        🏎️
      </span>
    </button>
  );
}

/** Carrinho visto de cima (arte própria; referência de proporção Toy Car Kit CC0). */
function Carrinho({ cor }: { cor: string }) {
  return (
    <g>
      <rect x={-4.2} y={-2} width={8.4} height={4} rx={1.6} fill={cor} stroke="var(--color-manu-cacau)" strokeWidth={0.35} />
      <rect x={-0.6} y={-1.5} width={2.8} height={3} rx={0.9} fill="var(--color-manu-nuvem)" opacity={0.9} />
      <rect x={-3.6} y={-2.6} width={2} height={0.9} rx={0.4} fill="var(--color-manu-cacau)" />
      <rect x={-3.6} y={1.7} width={2} height={0.9} rx={0.4} fill="var(--color-manu-cacau)" />
      <rect x={1.8} y={-2.6} width={2} height={0.9} rx={0.4} fill="var(--color-manu-cacau)" />
      <rect x={1.8} y={1.7} width={2} height={0.9} rx={0.4} fill="var(--color-manu-cacau)" />
    </g>
  );
}

export function Autorama() {
  const identidade = useIdentidade();
  const [fase, setFase] = useState<Fase>("menu");
  const [modo, setModo] = useState<Modo>("manu");
  const [nivelMax, setNivelMax] = useState<NivelAutorama>(1);
  const [nivelEscolhido, setNivelEscolhido] = useState<NivelAutorama>(1);
  const [nivelJogo, setNivelJogo] = useState<NivelAutorama>(1);
  const [contagem, setContagem] = useState(3);
  const [vencedor, setVencedor] = useState<number | null>(null);
  const [desbloqueou, setDesbloqueou] = useState(false);
  const [confete, setConfete] = useState(false);
  const [semente, setSemente] = useState(0);
  const mudo = useSyncExternalStore(assinarMudo, estaMudo, mudoNoServidor);

  const estadoRef = useRef<EstadoAutorama | null>(null);
  const iaRef = useRef<IaAutorama | null>(null);
  const modoRef = useRef<Modo>("manu");
  const nivelRef = useRef<NivelAutorama>(1);
  const faseRef = useRef<Fase>("menu");
  const dedos = useRef<[Set<number>, Set<number>]>([new Set(), new Set()]);
  const mainRef = useRef<HTMLElement | null>(null);
  const carro0Ref = useRef<SVGGElement | null>(null);
  const carro1Ref = useRef<SVGGElement | null>(null);
  const giro0Ref = useRef<SVGGElement | null>(null);
  const giro1Ref = useRef<SVGGElement | null>(null);
  const desdeHud = useRef(0);
  const lacoRef = useRef<LacoTempoReal | null>(null);
  const sementeRef = useRef(0);

  useEffect(() => {
    // a semente vai para a REF sincronamente: comecar() não pode depender do
    // setState assíncrono — no WebKit o IDB do lerProgresso perdia a corrida
    // para o primeiro toque e a partida nascia com semente 0
    const s = sementeInicial(window.location.search);
    sementeRef.current = s;
    void lerProgresso("autorama").then((p) => {
      setSemente(s);
      if (p && p.nivel >= 2) setNivelMax(2);
    });
  }, []);

  const publicarHud = useCallback((estado: EstadoAutorama) => {
    desdeHud.current = 0;
    const el = mainRef.current;
    if (!el) return;
    estado.carros.forEach((carro, i) => {
      el.setAttribute(`data-progresso-${i}`, String(Math.round(carro.progresso)));
      el.setAttribute(`data-velocidade-${i}`, String(Math.round(carro.velocidade)));
      el.setAttribute(`data-trecho-${i}`, String(trechoEm(estado.pista, carro.progresso)));
      el.setAttribute(`data-voltas-${i}`, String(carro.voltas));
      el.setAttribute(`data-rodando-${i}`, carro.rodando > 0 ? "true" : "false");
    });
    el.setAttribute("data-situacao", estado.situacao);
    el.setAttribute("data-vencedor", estado.vencedor === null ? "" : String(estado.vencedor));
    el.setAttribute("data-ticks", String(estado.ticks));
  }, []);

  const aoFim = useCallback(
    (estado: EstadoAutorama) => {
      lacoRef.current?.parar();
      publicarHud(estado);
      setVencedor(estado.vencedor);
      setFase("fim");
      faseRef.current = "fim";
      const ganhou = estado.vencedor === 0 || estado.vencedor === -1 || modoRef.current === "2p";
      tocar(ganhou ? "vitoria" : "erro");
      if (ganhou) setConfete(true);
      if (modoRef.current === "manu" && estado.vencedor === 0 && nivelRef.current === 1) {
        void salvarProgresso("autorama", 2).then(() => {
          setNivelMax(2);
          setDesbloqueou(true);
        });
      }
    },
    [publicarHud],
  );

  // laço de tempo real (SPEC §0.1) — criado uma vez; callbacks leem refs
  useEffect(() => {
    const laco = criarLaco({
      aoPasso: () => {
        const estado = estadoRef.current;
        if (!estado || estado.situacao !== "correndo") return;
        const jogador = dedos.current[0].size > 0;
        const pressionados =
          modoRef.current === "manu"
            ? [jogador, iaRef.current ? entradaIa(estado, iaRef.current) : false]
            : [jogador, dedos.current[1].size > 0];
        const novo = tick(estado, pressionados);
        novo.carros.forEach((carro, i) => {
          const antes = estado.carros[i];
          if (carro.rodando === SPIN_TICKS && antes.rodando === 0) tocar("erro");
          else if (carro.voltas > antes.voltas && novo.situacao !== "fim") tocar("acerto");
        });
        estadoRef.current = novo;
        desdeHud.current += 1;
        if (novo.situacao === "fim") aoFim(novo);
      },
      aoQuadro: () => {
        const estado = estadoRef.current;
        if (!estado) return;
        const grupos = [carro0Ref.current, carro1Ref.current];
        const giros = [giro0Ref.current, giro1Ref.current];
        estado.carros.forEach((carro, i) => {
          const g = grupos[i];
          if (!g) return;
          const ponto = pontoNoTrilho(nivelRef.current, carro.progresso, i === 0 ? -SLOT : SLOT);
          g.setAttribute(
            "transform",
            `translate(${ponto.x.toFixed(2)} ${ponto.y.toFixed(2)}) rotate(${((ponto.angulo * 180) / Math.PI).toFixed(1)})`,
          );
          giros[i]?.classList.toggle("autorama-rodando", carro.rodando > 0);
        });
        if (desdeHud.current >= HUD_A_CADA) publicarHud(estado);
      },
    });
    lacoRef.current = laco;
    return () => laco.parar();
  }, [aoFim, publicarHud]);

  const pausar = useCallback(() => {
    if (faseRef.current !== "correndo") return;
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

  // auto-pausa: criança trocou de app / minimizou (SPEC §0.3)
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

  // contagem 3-2-1 (largada e retorno de pausa) — não conta ticks (§0.3)
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

  const comecar = (novoModo: Modo) => {
    const nivel = nivelEscolhido;
    setModo(novoModo);
    modoRef.current = novoModo;
    setNivelJogo(nivel);
    nivelRef.current = nivel;
    estadoRef.current = criarPartida(nivel);
    iaRef.current =
      novoModo === "manu" ? criarIa(PISTAS[nivel], nivel, criarSorte(sementeRef.current)) : null;
    dedos.current[0].clear();
    dedos.current[1].clear();
    setVencedor(null);
    setDesbloqueou(false);
    setConfete(false);
    setContagem(3);
    setFase("contagem");
    faseRef.current = "contagem";
  };

  const retomar = () => {
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

  const nomeMascote = aMascote(identidade);
  const tituloMascote = nomeMascote.charAt(0).toUpperCase() + nomeMascote.slice(1);
  const correndo = fase === "correndo" || fase === "contagem" || fase === "pausa";

  return (
    <main
      ref={mainRef}
      data-semente={semente}
      data-nivel={nivelJogo}
      data-modo={modo}
      className="flex h-[100dvh] flex-col overflow-hidden"
    >
      <header className="flex h-16 shrink-0 items-center gap-2 px-2 pt-[env(safe-area-inset-top)] deitado:h-12">
        <Link
          href="/"
          aria-label="voltar para os jogos"
          onPointerDown={() => feedback("toque")}
          className="bolha h-14 min-h-14 w-14 min-w-14 overflow-hidden bg-manu-sol/40 ring-2 ring-manu-sol-forte"
        >
          <Mascote pose="rosto" tamanho={56} className="h-14 w-14 object-cover" />
        </Link>
        <h1 className="hidden font-titulo text-xl text-manu-cacau sm:block">Autorama</h1>
        {correndo || fase === "fim" ? (
          <span className="rounded-full bg-manu-sol/50 px-3 py-1 font-titulo text-sm text-manu-cacau">
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
          <p className="text-center font-titulo text-2xl text-manu-cacau">Quem vai correr?</p>
          <div className="flex flex-wrap justify-center gap-4">
            <BotaoBolha rotulo={`correr com ${nomeMascote}`} tamanho="xl" onClick={() => comecar("manu")}>
              <span data-modo-opcao="manu" className="px-4 font-titulo text-xl">{`Com ${nomeMascote}`}</span>
            </BotaoBolha>
            <BotaoBolha rotulo="dois jogadores" tamanho="xl" onClick={() => comecar("2p")}>
              <span data-modo-opcao="2p" className="px-4 font-titulo text-xl">
                2 jogadores
              </span>
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
                    setNivelEscolhido(n);
                  }}
                  className={`bolha min-h-12 px-4 font-titulo text-lg ${
                    nivelEscolhido === n
                      ? "bg-manu-sol ring-2 ring-manu-sol-forte"
                      : "bg-manu-papel ring-2 ring-manu-cacau/10"
                  }`}
                >
                  {n === 1 ? "Oval" : "Chicane"}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="relative flex min-h-0 flex-1 flex-col deitado:flex-row">
          <div className="relative flex min-h-0 flex-1 items-center justify-center px-2">
            <svg
              viewBox={viewBoxDoTrilho(nivelJogo)}
              role="img"
              aria-label="trilho do autorama"
              data-trilho
              className="h-full max-h-full w-full max-w-full"
            >
              <polyline
                points={pontosDaLinha(nivelJogo, 0)}
                fill="none"
                stroke="var(--color-manu-cacau)"
                strokeOpacity={0.18}
                strokeWidth={11}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {[-SLOT, SLOT].map((desloc) => (
                <polyline
                  key={desloc}
                  points={pontosDaLinha(nivelJogo, desloc)}
                  fill="none"
                  stroke="var(--color-manu-cacau)"
                  strokeOpacity={0.45}
                  strokeWidth={0.5}
                  strokeDasharray="1.6 1.2"
                />
              ))}
              {/* linha de largada/chegada */}
              <g
                transform={(() => {
                  const p = pontoNoTrilho(nivelJogo, 0, 0);
                  return `translate(${p.x.toFixed(2)} ${p.y.toFixed(2)}) rotate(${((p.angulo * 180) / Math.PI).toFixed(1)})`;
                })()}
              >
                <rect x={-0.9} y={-5.5} width={1.8} height={11} fill="var(--color-manu-papel)" stroke="var(--color-manu-cacau)" strokeWidth={0.3} />
              </g>
              <g ref={carro0Ref}>
                <g ref={giro0Ref}>
                  <Carrinho cor={CARROS[0].corpo} />
                </g>
              </g>
              <g ref={carro1Ref}>
                <g ref={giro1Ref}>
                  <Carrinho cor={CARROS[1].corpo} />
                </g>
              </g>
            </svg>

            {fase === "contagem" ? (
              <div
                data-contagem={contagem}
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
                className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-manu-nuvem/85 px-4"
              >
                <p className="text-center font-titulo text-3xl text-manu-cacau">
                  {vencedor === -1
                    ? "Empate! Os dois ganharam!"
                    : modo === "manu"
                      ? vencedor === 0
                        ? "Você ganhou!"
                        : `${tituloMascote} ganhou! Tente de novo`
                      : `Jogador ${(vencedor ?? 0) + 1} ganhou!`}
                </p>
                {desbloqueou ? (
                  <p className="font-titulo text-xl text-manu-rosa-texto">Pista 2 aberta! 🎉</p>
                ) : null}
                <div className="flex gap-3">
                  <BotaoBolha rotulo="correr de novo" tamanho="xl" onClick={() => comecar(modo)}>
                    <span data-de-novo className="px-4 font-titulo text-xl">
                      De novo
                    </span>
                  </BotaoBolha>
                  <BotaoBolha rotulo="escolher outro modo" onClick={voltarAoMenu}>
                    <span className="px-3 font-titulo text-lg">Menu</span>
                  </BotaoBolha>
                </div>
              </div>
            ) : null}
          </div>

          <div className="flex shrink-0 gap-3 px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-1 deitado:w-40 deitado:flex-col deitado:pt-3">
            {modo === "2p" ? (
              <>
                <BotaoAcelerar indice={0} dedos={dedos} rotulo="acelerar jogador 1" className={CARROS[0].botao} />
                <BotaoAcelerar indice={1} dedos={dedos} rotulo="acelerar jogador 2" className={CARROS[1].botao} />
              </>
            ) : (
              <BotaoAcelerar indice={0} dedos={dedos} rotulo="acelerar" className={CARROS[0].botao} />
            )}
          </div>
        </div>
      )}

      <Confete gatilho={confete ? 1 : 0} duracao={1800} />
    </main>
  );
}
