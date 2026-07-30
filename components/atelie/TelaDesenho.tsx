"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Motor } from "@/lib/desenho/motor";
import type { Ferramenta } from "@/lib/desenho/ferramentas";
import type { Operacao, OperacaoTraco, Ponto } from "@/lib/desenho/tipos";
import { acordarAudio, tocar, vibrar } from "@/lib/som";
import { Icone } from "@/components/ui-kids/Icone";

type Props = {
  ferramenta: Ferramenta;
  /** Livro de colorir (SVG) por cima dos traços — contorno sempre nítido. */
  camadaColorir?: ReactNode;
  /** Deixa o SVG do livro receber o toque (quando o balde está ativo). */
  colorirClicavel?: boolean;
  aoMotorPronto: (motor: Motor) => void;
  aoOperar: () => void;
};

/**
 * Contato maior que isto é palma da mão apoiada, não dedo desenhando.
 *
 * Era 68 e barrava dedo de verdade: o polegar registra 70-90 de contato, e o
 * próprio app dimensiona os alvos para 72 justamente porque é esse o tamanho do
 * dedo. O toque virava silêncio — nada de traço, nada de balde. Palma apoiada
 * passa bem disto, então o número alto continua filtrando o que precisa.
 */
const CONTATO_MAX = 150;
const ZOOM_MIN = 1;
const ZOOM_MAX = 5;
/**
 * Um traço contínuo é fatiado a cada tantos pontos: a prévia redesenha o traço
 * inteiro por quadro, e um rabisco de minutos sem soltar o dedo degradaria o
 * frame rate. A emenda reaproveita o último ponto, então não aparece.
 * Efeito colateral bem-vindo: o desfazer volta em pedaços, não o rabisco todo.
 */
const PONTOS_POR_TRACO = 700;
type Vista = { escala: number; tx: number; ty: number };

export function TelaDesenho({
  ferramenta,
  camadaColorir,
  colorirClicavel = false,
  aoMotorPronto,
  aoOperar,
}: Props) {
  const caixa = useRef<HTMLDivElement>(null);
  const refFundo = useRef<HTMLCanvasElement>(null);
  const refArte = useRef<HTMLCanvasElement>(null);
  const refPrevia = useRef<HTMLCanvasElement>(null);
  const motor = useRef<Motor | null>(null);

  const [vista, setVista] = useState<Vista>({ escala: 1, tx: 0, ty: 0 });

  const ativos = useRef<Map<number, { x: number; y: number }>>(new Map());
  const tracando = useRef<{
    id: number;
    op: OperacaoTraco;
    t: number;
    x: number;
    y: number;
  } | null>(null);
  const formando = useRef<{ id: number; x1: number; y1: number } | null>(null);
  const gesto = useRef<{ dist: number; escala: number; cx: number; cy: number; tx: number; ty: number } | null>(
    null,
  );
  const quadro = useRef<number | null>(null);

  // ------------------------------------------------------------------ montagem

  useEffect(() => {
    const fundo = refFundo.current;
    const arte = refArte.current;
    const previa = refPrevia.current;
    const div = caixa.current;
    if (!fundo || !arte || !previa || !div) return;

    const m = new Motor({ fundo, arte, previa });
    motor.current = m;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const ajustar = () => {
      const r = div.getBoundingClientRect();
      m.redimensionar(r.width, r.height, dpr);
    };
    ajustar();
    aoMotorPronto(m);

    const observador = new ResizeObserver(ajustar);
    observador.observe(div);
    return () => observador.disconnect();
  }, [aoMotorPronto]);

  // ------------------------------------------------------------------ coordenadas

  /** Tela -> canvas. O rect já reflete o zoom/pan (é transform CSS). */
  const paraCanvas = useCallback((clientX: number, clientY: number) => {
    const canvas = refArte.current;
    if (!canvas) return { x: 0, y: 0 };
    const r = canvas.getBoundingClientRect();
    return {
      x: ((clientX - r.left) / r.width) * canvas.width,
      y: ((clientY - r.top) / r.height) * canvas.height,
    };
  }, []);

  const pintarPrevia = useCallback((op: Operacao | null) => {
    if (quadro.current !== null) return;
    quadro.current = requestAnimationFrame(() => {
      quadro.current = null;
      motor.current?.previa(op);
    });
  }, []);

  const cancelarTraco = useCallback(() => {
    tracando.current = null;
    formando.current = null;
    motor.current?.previa(null);
  }, []);

  // ------------------------------------------------------------------ ponteiros

  const aoDescer = (e: React.PointerEvent) => {
    acordarAudio(); // primeiro gesto libera o áudio no navegador
    ativos.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // Dois dedos = zoom/pan. O traço que já tinha começado é DESCARTADO:
    // criança apoia a mão e encosta sem querer, e um risco fantasma no meio do
    // desenho é pior do que perder o começo do traço.
    if (ativos.current.size >= 2) {
      const [a, b] = [...ativos.current.values()];
      const v = vista;
      gesto.current = {
        dist: Math.hypot(a.x - b.x, a.y - b.y),
        escala: v.escala,
        cx: (a.x + b.x) / 2,
        cy: (a.y + b.y) / 2,
        tx: v.tx,
        ty: v.ty,
      };
      cancelarTraco();
      return;
    }

    const f = ferramenta;
    const { x, y } = paraCanvas(e.clientX, e.clientY);
    const m = motor.current;
    if (!m) return;

    // Palma apoiada na tela: contato largo demais para ser dedo de desenho. Só
    // vale para o traço, que é o que deixaria um risco atravessado no desenho;
    // o balde é um toque pontual e o desfazer resolve, então recusá-lo só faria
    // a criança tocar de novo achando que o app travou.
    if (
      f.modo !== "balde" &&
      e.pointerType === "touch" &&
      (e.width > CONTATO_MAX || e.height > CONTATO_MAX)
    ) {
      return;
    }

    if (f.modo === "balde") {
      m.aplicar({ kind: "balde", cor: f.cor, x, y });
      tocar("balde");
      vibrar(18);
      aoOperar();
      return;
    }

    if (f.modo === "carimbo") {
      m.aplicar({
        kind: "carimbo",
        emoji: f.carimbo,
        x,
        y,
        tamanho: Math.max(48, f.espessura * 4),
        // leve giro para a "chuva de carimbos" não sair enfileirada igual
        giro: (Math.random() - 0.5) * 0.5,
      });
      tocar("carimbo");
      vibrar(14);
      aoOperar();
      return;
    }

    if (f.modo === "forma") {
      formando.current = { id: e.pointerId, x1: x, y1: y };
      return;
    }

    tracando.current = {
      id: e.pointerId,
      t: performance.now(),
      x,
      y,
      op: {
        kind: "traco",
        pincel: f.pincel,
        cor: f.cor,
        espessura: f.espessura,
        simetria: f.simetria,
        pontos: [{ x, y, f: 0.7 }],
      },
    };
    pintarPrevia(tracando.current.op);
  };

  const aoMover = (e: React.PointerEvent) => {
    if (ativos.current.has(e.pointerId)) {
      ativos.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    // pinça: dois dedos ajustam zoom e arrastam a tela
    if (gesto.current && ativos.current.size >= 2) {
      const [a, b] = [...ativos.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const g = gesto.current;
      const escala = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, (g.escala * dist) / (g.dist || 1)));
      const cx = (a.x + b.x) / 2;
      const cy = (a.y + b.y) / 2;
      setVista({ escala, tx: g.tx + (cx - g.cx), ty: g.ty + (cy - g.cy) });
      return;
    }

    const f = ferramenta;

    if (formando.current && formando.current.id === e.pointerId) {
      const { x, y } = paraCanvas(e.clientX, e.clientY);
      pintarPrevia({
        kind: "forma",
        forma: f.forma,
        cor: f.cor,
        espessura: f.espessura,
        preenchida: false,
        x1: formando.current.x1,
        y1: formando.current.y1,
        x2: x,
        y2: y,
      });
      return;
    }

    const t = tracando.current;
    if (!t || t.id !== e.pointerId) return;

    // getCoalescedEvents entrega os pontos que o navegador juntou entre quadros:
    // é o que mantém a curva lisa quando o dedo corre rápido.
    const eventos =
      typeof e.nativeEvent.getCoalescedEvents === "function"
        ? e.nativeEvent.getCoalescedEvents()
        : [];
    const brutos = eventos.length > 0 ? eventos : [e.nativeEvent];

    for (const bruto of brutos) {
      const { x, y } = paraCanvas(bruto.clientX, bruto.clientY);
      const agora = performance.now();
      const dt = Math.max(1, agora - t.t);
      const dist = Math.hypot(x - t.x, y - t.y);
      // Caneta informa pressão de verdade; no dedo usamos a velocidade:
      // devagar = traço cheio, rápido = traço fino (como pincel de verdade).
      const velocidade = dist / dt;
      const forca =
        bruto.pointerType === "pen" && bruto.pressure > 0
          ? bruto.pressure
          : Math.max(0.15, Math.min(1, 1 - velocidade / 2.6));

      const ponto: Ponto = { x, y, f: forca };
      t.op.pontos.push(ponto);
      t.t = agora;
      t.x = x;
      t.y = y;
    }

    if (t.op.pontos.length >= PONTOS_POR_TRACO) {
      const m = motor.current;
      if (m) {
        m.previa(null);
        m.aplicar(t.op);
        aoOperar();
        // continua o mesmo gesto num traço novo, emendado no ponto final
        const ultimo = t.op.pontos[t.op.pontos.length - 1];
        t.op = { ...t.op, pontos: [ultimo] };
      }
    }

    pintarPrevia(t.op);
  };

  const aoSubir = (e: React.PointerEvent) => {
    ativos.current.delete(e.pointerId);
    if (ativos.current.size < 2) gesto.current = null;

    const m = motor.current;
    const f = ferramenta;
    if (!m) return;

    if (formando.current && formando.current.id === e.pointerId) {
      const { x, y } = paraCanvas(e.clientX, e.clientY);
      const { x1, y1 } = formando.current;
      formando.current = null;
      m.previa(null);
      // toque sem arrastar não vira forma de tamanho zero
      if (Math.hypot(x - x1, y - y1) > 6) {
        m.aplicar({
          kind: "forma",
          forma: f.forma,
          cor: f.cor,
          espessura: f.espessura,
          preenchida: false,
          x1,
          y1,
          x2: x,
          y2: y,
        });
        tocar("pincel");
        aoOperar();
      }
      return;
    }

    const t = tracando.current;
    if (!t || t.id !== e.pointerId) return;
    tracando.current = null;
    m.previa(null);
    m.aplicar(t.op);
    vibrar(8);
    aoOperar();
  };

  const aoCancelar = (e: React.PointerEvent) => {
    ativos.current.delete(e.pointerId);
    if (ativos.current.size < 2) gesto.current = null;
    if (tracando.current?.id === e.pointerId || formando.current?.id === e.pointerId) {
      cancelarTraco();
    }
  };

  useEffect(() => {
    return () => {
      if (quadro.current !== null) cancelAnimationFrame(quadro.current);
    };
  }, []);

  const enquadrado = vista.escala === 1 && vista.tx === 0 && vista.ty === 0;

  return (
    <div ref={caixa} className="relative flex-1 overflow-hidden bg-manu-papel">
      <div
        className="tela-desenho absolute inset-0 origin-center"
        style={{
          transform: `translate(${vista.tx}px, ${vista.ty}px) scale(${vista.escala})`,
        }}
        onPointerDown={aoDescer}
        onPointerMove={aoMover}
        onPointerUp={aoSubir}
        onPointerCancel={aoCancelar}
        onPointerLeave={aoCancelar}
        onContextMenu={(e) => e.preventDefault()}
      >
        <canvas ref={refFundo} className="absolute inset-0 h-full w-full" />
        <canvas ref={refArte} className="absolute inset-0 h-full w-full" />
        <canvas ref={refPrevia} className="absolute inset-0 h-full w-full" />
        {camadaColorir ? (
          <div
            className={`absolute inset-0 grid place-items-center ${
              colorirClicavel ? "" : "pointer-events-none"
            }`}
          >
            {camadaColorir}
          </div>
        ) : null}
      </div>

      {!enquadrado ? (
        <button
          type="button"
          aria-label="Voltar o desenho para o lugar"
          onClick={() => {
            tocar("desfazer");
            setVista({ escala: 1, tx: 0, ty: 0 });
          }}
          className="bolha absolute right-3 top-3 min-h-14 min-w-14 bg-manu-papel/95 ring-2 ring-manu-cacau/10"
        >
          <Icone nome="alvo" tamanho={28} />
        </button>
      ) : null}
    </div>
  );
}
