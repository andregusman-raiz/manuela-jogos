"use client";

import Link from "next/link";
import { daMascote } from "@/lib/identidade";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { BotaoBolha } from "@/components/ui-kids/BotaoBolha";
import { Confete } from "@/components/ui-kids/Confete";
import { Icone } from "@/components/ui-kids/Icone";
import { Mascote } from "@/components/ui-kids/Mascote";
import { lerProgresso, salvarProgresso } from "@/lib/armazenamento";
import { CORES_PECAS, QUIRAL, SILHUETAS } from "@/lib/tangram/dados";
import type { NomePeca, Pose } from "@/lib/tangram/dados";
import { PECAS, verificarEncaixe, verticesNoTabuleiro } from "@/lib/tangram/motor";
import { assinarMudo, definirMudo, estaMudo, feedback, mudoNoServidor, tocar } from "@/lib/som";

/** Bandeja inicial em DUAS linhas — os bboxes somam 231 de largura, então uma
 *  fila única sobrepunha as peças (QAT 2026-07-31). Poses conferidas contra os
 *  VERTICES: peças não se tocam entre si nem vazam o viewBox 200. A borda de
 *  baixo de algumas silhuetas passa POR TRÁS da fila de cima — limitação do
 *  viewBox compartilhado que já existia na bandeja antiga; as peças são
 *  móveis e o alvo aparece assim que saem do lugar. */
const BANDEJA: Record<NomePeca, { x: number; y: number }> = {
  g1: { x: 32, y: 150 },
  g2: { x: 90, y: 150 },
  m: { x: 145, y: 154 },
  q: { x: 185, y: 152 },
  p1: { x: 30, y: 184 },
  p2: { x: 60, y: 184 },
  para: { x: 130, y: 188 },
};

function posesIniciais(): Record<NomePeca, Pose> {
  const poses = {} as Record<NomePeca, Pose>;
  PECAS.forEach((peca) => {
    poses[peca] = { ...BANDEJA[peca], rotacao: 0, espelhado: false };
  });
  return poses;
}

function pontos(peca: NomePeca, pose: Pose): string {
  return verticesNoTabuleiro(peca, pose)
    .map(([x, y]) => `${x},${y}`)
    .join(" ");
}

/**
 * Tangram da Manu — SPEC onda 3 §3.3. TODA interação é convertida para
 * coordenadas LÓGICAS via getScreenCTM().inverse() — imune a escala e
 * letterbox; o snap (16px lógicos + rotação modular) vive no motor.
 */
export function Tangram() {
  const [indice, setIndice] = useState<number | null>(null);
  const [poses, setPoses] = useState<Record<NomePeca, Pose>>(posesIniciais);
  const [encaixadas, setEncaixadas] = useState<NomePeca[]>([]);
  const [selecionada, setSelecionada] = useState<NomePeca | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const arrasto = useRef<{ peca: NomePeca; pointerId: number; dx: number; dy: number } | null>(
    null,
  );
  // pose corrente do arrasto em REF: o pointerup pode chegar antes do
  // re-render e o closure veria a pose de um quadro atrás
  const poseArrastada = useRef<Pose | null>(null);
  const mudo = useSyncExternalStore(assinarMudo, estaMudo, mudoNoServidor);

  useEffect(() => {
    void lerProgresso("tangram").then((p) => {
      setIndice(Math.min(Math.max((p?.nivel ?? 1) - 1, 0), SILHUETAS.length - 1));
    });
  }, []);

  const silhueta = indice === null ? null : SILHUETAS[indice];
  const completa = encaixadas.length === PECAS.length;

  useEffect(() => {
    if (!completa || indice === null) return;
    tocar("vitoria");
    void salvarProgresso("tangram", Math.min(indice + 2, SILHUETAS.length));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completa]);

  function paraLogico(evento: { clientX: number; clientY: number }): [number, number] {
    const svg = svgRef.current!;
    const ponto = svg.createSVGPoint();
    ponto.x = evento.clientX;
    ponto.y = evento.clientY;
    const local = ponto.matrixTransform(svg.getScreenCTM()!.inverse());
    return [local.x, local.y];
  }

  function aoAgarrar(peca: NomePeca, evento: React.PointerEvent) {
    if (encaixadas.includes(peca) || completa) return;
    // UMA peça por vez: um segundo dedo não rouba o arrasto em andamento
    if (arrasto.current) return;
    feedback("toque");
    setSelecionada(peca);
    // captura do ponteiro: os moves seguem chegando mesmo se o cursor sair da
    // peça no meio do arrasto (WebKit derrubava o drag sem isto)
    (evento.target as Element).setPointerCapture?.(evento.pointerId);
    const [lx, ly] = paraLogico(evento);
    poseArrastada.current = poses[peca];
    arrasto.current = {
      peca,
      pointerId: evento.pointerId,
      dx: poses[peca].x - lx,
      dy: poses[peca].y - ly,
    };
  }

  function aoMover(evento: React.PointerEvent) {
    const atual = arrasto.current;
    if (!atual || evento.pointerId !== atual.pointerId) return;
    const [lx, ly] = paraLogico(evento);
    const nova = {
      ...(poseArrastada.current ?? poses[atual.peca]),
      x: Math.min(195, Math.max(5, lx + atual.dx)),
      y: Math.min(195, Math.max(5, ly + atual.dy)),
    };
    poseArrastada.current = nova;
    setPoses((p) => ({ ...p, [atual.peca]: nova }));
  }

  function aoSoltar(evento?: React.PointerEvent) {
    const atual = arrasto.current;
    if (!atual) return;
    if (evento && evento.pointerId !== atual.pointerId) return;
    arrasto.current = null;
    const pose = poseArrastada.current;
    poseArrastada.current = null;
    if (!silhueta || !pose) return;
    const alvo = silhueta.alvos.find((a) => a.peca === atual.peca)!;
    // efeitos FORA de updaters (StrictMode reexecuta updaters)
    if (verificarEncaixe(atual.peca, pose, alvo)) {
      tocar("passo");
      setPoses((p) => ({ ...p, [atual.peca]: { ...alvo } }));
      setEncaixadas((e) => (e.includes(atual.peca) ? e : [...e, atual.peca]));
      setSelecionada(null);
    }
  }

  function girar() {
    if (!selecionada || encaixadas.includes(selecionada)) return;
    tocar("cor");
    setPoses((p) => ({
      ...p,
      [selecionada]: { ...p[selecionada], rotacao: (p[selecionada].rotacao + 45) % 360 },
    }));
  }

  function espelhar() {
    if (!selecionada || !QUIRAL[selecionada] || encaixadas.includes(selecionada)) return;
    tocar("cor");
    setPoses((p) => ({
      ...p,
      [selecionada]: { ...p[selecionada], espelhado: !p[selecionada].espelhado },
    }));
  }

  function novaSilhueta(novoIndice: number) {
    setIndice(novoIndice);
    setPoses(posesIniciais());
    setEncaixadas([]);
    setSelecionada(null);
  }

  return (
    <main
      data-silhueta={silhueta?.nome ?? ""}
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
        <h1 className="hidden font-titulo text-xl text-manu-cacau sm:block">{`Tangram ${daMascote()}`}</h1>
        {indice !== null ? (
          <span className="rounded-full bg-manu-ceu-claro px-3 py-1 font-titulo text-sm text-manu-cacau">
            {indice + 1} de {SILHUETAS.length}
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

      {silhueta ? (
        <p
          data-encaixadas={encaixadas.length}
          className="shrink-0 py-1 text-center font-titulo text-lg text-manu-cacau-suave"
        >
          {completa ? "Montou!" : `Monte: ${silhueta.nome} (${encaixadas.length}/7)`}
        </p>
      ) : null}

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 pb-1">
        {silhueta && !completa ? (
          <svg
            ref={svgRef}
            viewBox="0 0 200 200"
            role="img"
            aria-label={`silhueta de ${silhueta.nome}`}
            className="h-full max-h-full w-auto max-w-full touch-none select-none"
            onPointerMove={aoMover}
            onPointerUp={aoSoltar}
            onPointerLeave={() => aoSoltar()}
            onPointerCancel={aoSoltar}
          >
            {/* sombras-alvo */}
            {silhueta.alvos.map((alvo) => (
              <polygon
                key={`alvo-${alvo.peca}`}
                points={pontos(alvo.peca, alvo)}
                fill="#2e1408"
                opacity="0.12"
              />
            ))}
            {/* peças (encaixadas primeiro, arrastável por cima) */}
            {[...PECAS]
              .sort((a, b) => Number(encaixadas.includes(a)) - Number(encaixadas.includes(b)))
              .map((peca) => {
                const alvo = silhueta.alvos.find((a) => a.peca === peca)!;
                const fixa = encaixadas.includes(peca);
                return (
                  <polygon
                    key={peca}
                    data-peca={peca}
                    data-encaixada={fixa ? "true" : "false"}
                    data-alvo-x={alvo.x}
                    data-alvo-y={alvo.y}
                    data-alvo-rot={alvo.rotacao}
                    points={pontos(peca, poses[peca])}
                    fill={CORES_PECAS[peca]}
                    stroke={selecionada === peca && !fixa ? "#c2517f" : "#2e1408"}
                    strokeWidth={selecionada === peca && !fixa ? 2.5 : 1}
                    opacity={fixa ? 0.85 : 1}
                    onPointerDown={(evento) => aoAgarrar(peca, evento)}
                  />
                );
              })}
          </svg>
        ) : null}

        {completa && indice !== null ? (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-manu-nuvem/95 px-4">
            <Mascote pose="comemorando" tamanho={150} className="h-36 w-auto drop-shadow-md" />
            <p className="text-center font-titulo text-3xl text-manu-cacau">
              Você montou: {SILHUETAS[indice].nome}!
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <BotaoBolha rotulo="montar de novo" tamanho="xl" onClick={() => novaSilhueta(indice)}>
                <span className="px-3 font-titulo text-2xl">De novo</span>
              </BotaoBolha>
              {indice < SILHUETAS.length - 1 ? (
                <BotaoBolha
                  rotulo="próxima silhueta"
                  tamanho="xl"
                  efeito="abrir"
                  onClick={() => novaSilhueta(indice + 1)}
                  className="bg-manu-sol"
                >
                  <span className="px-3 font-titulo text-2xl">Próxima</span>
                </BotaoBolha>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      {silhueta && !completa ? (
        <div className="flex shrink-0 items-center justify-center gap-3 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <BotaoBolha
            rotulo="girar a peça"
            onClick={girar}
            desabilitado={!selecionada || encaixadas.includes(selecionada)}
          >
            ⟳
          </BotaoBolha>
          <BotaoBolha
            rotulo="espelhar a peça"
            onClick={espelhar}
            desabilitado={
              !selecionada || !QUIRAL[selecionada] || encaixadas.includes(selecionada)
            }
          >
            ⇋
          </BotaoBolha>
        </div>
      ) : null}

      <Confete gatilho={completa ? 1 : 0} duracao={1800} />
    </main>
  );
}
