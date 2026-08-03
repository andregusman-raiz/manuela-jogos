"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { PortaoParental } from "@/components/ui-kids/PortaoParental";
import { processarCorpo, recortarAvatar } from "@/lib/imagem-canvas";
import {
  MAXIMO_DINAMICOS,
  PERFIS,
  anelPorGenero,
  apagarPerfilDinamico,
  criarPerfilDinamico,
  editarPerfilDinamico,
  listarPerfis,
  salvarJogador,
  type Perfil,
} from "@/lib/perfis";
import { feedback, tocar } from "@/lib/som";

/**
 * Assistente "Novo jogador" (SPEC-perfis-pela-interface §4) — fluxo do ADULTO,
 * atrás do Portão Parental: foto do corpo inteiro → recorte do rosto → nome e
 * gênero. Também edita e apaga perfis dinâmicos (id imutável; apagar sempre
 * leva os salvamentos — decisão do juiz da SPEC).
 */

type Passo = "portao" | "foto" | "rosto" | "dados" | "salvando";

interface Props {
  aberto: boolean;
  /** null = criar; Perfil dinâmico = editar. */
  editando: Perfil | null;
  onFechar: () => void;
}

interface Recorte {
  x: number;
  y: number;
  lado: number;
}

function prenderTab(e: React.KeyboardEvent<HTMLDivElement>) {
  if (e.key !== "Tab") return;
  const raiz = e.currentTarget;
  const focaveis = raiz.querySelectorAll<HTMLElement>(
    'button, input, [tabindex]:not([tabindex="-1"])',
  );
  if (focaveis.length === 0) return;
  const primeiro = focaveis[0];
  const ultimo = focaveis[focaveis.length - 1];
  if (e.shiftKey && document.activeElement === primeiro) {
    e.preventDefault();
    ultimo.focus();
  } else if (!e.shiftKey && document.activeElement === ultimo) {
    e.preventDefault();
    primeiro.focus();
  }
}

export function NovoJogador({ aberto, editando, onFechar }: Props) {
  // o pai remonta este componente por `key` a cada abertura: o estado
  // inicial vem das props, sem reset via effect (lint da casa)
  const [passo, setPasso] = useState<Passo>("portao");
  const [erro, setErro] = useState<string | null>(null);
  const [corpo, setCorpo] = useState<{
    blob: Blob;
    largura: number;
    altura: number;
    previa: string;
  } | null>(null);
  const [recorte, setRecorte] = useState<Recorte>({ x: 0, y: 0, lado: 100 });
  const [nome, setNome] = useState(editando?.identidade.nome ?? "");
  const [apelido, setApelido] = useState(editando?.identidade.apelido ?? "");
  const [genero, setGenero] = useState<"a" | "o">(editando?.identidade.genero ?? "a");
  const [confirmandoApagar, setConfirmandoApagar] = useState(false);
  const [processando, setProcessando] = useState(false);
  const geracaoFoto = useRef(0);
  const desmontado = useRef(false);
  const quadroRef = useRef<HTMLDivElement | null>(null);
  const arrasto = useRef<{ tipo: "mover" | "tamanho"; x: number; y: number; base: Recorte } | null>(
    null,
  );

  // previas de blob são deste assistente: revogar ao trocar/fechar
  useEffect(() => {
    return () => {
      if (corpo) URL.revokeObjectURL(corpo.previa);
    };
  }, [corpo]);

  useEffect(() => {
    desmontado.current = false;
    return () => {
      desmontado.current = true;
      geracaoFoto.current++; // cancela qualquer processamento em voo
    };
  }, []);

  // foco entra no diálogo (review PR #53: abrir por teclado deixava o foco
  // no picker encoberto); Tab fica preso via prenderTab no container
  const dialogoRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    dialogoRef.current?.focus();
  }, []);

  if (!aberto) return null;

  async function aoEscolherArquivo(file: File | undefined) {
    if (!file) return;
    setErro(null);
    // review PR #53: nova escolha CANCELA a anterior (foto pesada que termina
    // depois não pode sobrescrever a mais nova; fechar descarta em voo)
    const minha = ++geracaoFoto.current;
    setProcessando(true);
    const resultado = await processarCorpo(file);
    if (minha !== geracaoFoto.current || desmontado.current) {
      if (resultado.ok) URL.revokeObjectURL(resultado.previa);
      return;
    }
    setProcessando(false);
    if (!resultado.ok) {
      setErro(
        resultado.motivo === "grande"
          ? "Essa foto é grande demais — tente outra."
          : resultado.motivo === "vazia"
            ? "Não achei ninguém na foto — tente outra."
            : "Essa foto não abriu — tente outra.",
      );
      return;
    }
    tocar("acerto");
    setCorpo(resultado);
    // recorte inicial: terço superior central
    const lado = Math.round(Math.min(resultado.largura, resultado.altura) * 0.5);
    setRecorte({ x: Math.round((resultado.largura - lado) / 2), y: 0, lado });
    setPasso("rosto");
  }

  function clampRecorte(r: Recorte): Recorte {
    if (!corpo) return r;
    const menorDim = Math.min(corpo.largura, corpo.altura);
    const lado = Math.min(Math.max(Math.min(48, menorDim), r.lado), menorDim);
    return {
      lado,
      x: Math.max(0, Math.min(r.x, corpo.largura - lado)),
      y: Math.max(0, Math.min(r.y, corpo.altura - lado)),
    };
  }

  function escalaDoQuadro(): number {
    if (!corpo || !quadroRef.current) return 1;
    return quadroRef.current.clientWidth / corpo.largura;
  }

  function aoPointerDown(e: React.PointerEvent, tipo: "mover" | "tamanho") {
    e.preventDefault();
    (e.target as Element).setPointerCapture(e.pointerId);
    arrasto.current = { tipo, x: e.clientX, y: e.clientY, base: recorte };
  }

  function aoPointerMove(e: React.PointerEvent) {
    if (!arrasto.current) return;
    const escala = escalaDoQuadro();
    const dx = (e.clientX - arrasto.current.x) / escala;
    const dy = (e.clientY - arrasto.current.y) / escala;
    const base = arrasto.current.base;
    setRecorte(
      clampRecorte(
        arrasto.current.tipo === "mover"
          ? { ...base, x: Math.round(base.x + dx), y: Math.round(base.y + dy) }
          : { ...base, lado: Math.round(base.lado + Math.max(dx, dy)) },
      ),
    );
  }

  function aoPointerUp() {
    arrasto.current = null;
  }

  async function salvar() {
    setErro(null);
    if (!nome.trim()) {
      setErro("Confira o nome (precisa de pelo menos uma letra) e tente de novo.");
      return;
    }
    setPasso("salvando");
    try {
      if (editando) {
        const avatar = corpo ? await recortarAvatar(corpo.blob, recorte) : null;
        await editarPerfilDinamico(editando.id, {
          nome,
          apelido,
          genero,
          ...(corpo && avatar
            ? {
                corpo: corpo.blob,
                corpoLargura: corpo.largura,
                corpoAltura: corpo.altura,
                avatar,
              }
            : {}),
        });
      } else {
        if (!corpo) throw new Error("sem foto");
        const avatar = await recortarAvatar(corpo.blob, recorte);
        if (!avatar) throw new Error("não deu para recortar o rosto");
        const id = await criarPerfilDinamico({
          nome,
          apelido,
          genero,
          corpo: corpo.blob,
          corpoLargura: corpo.largura,
          corpoAltura: corpo.altura,
          avatar,
        });
        salvarJogador(id);
      }
      tocar("vitoria");
      onFechar();
    } catch (e) {
      console.warn("salvar perfil falhou", e);
      setPasso("dados");
      setErro(
        e instanceof Error && e.message.includes("limite")
          ? `Já tem ${MAXIMO_DINAMICOS} jogadores criados — apague um primeiro.`
          : "Confira o nome (precisa de pelo menos uma letra) e tente de novo.",
      );
    }
  }

  async function apagar() {
    if (!editando) return;
    setPasso("salvando");
    try {
      await apagarPerfilDinamico(editando.id);
      tocar("passo");
      onFechar();
    } catch {
      setPasso("dados");
      setErro("Não deu para apagar — tente de novo.");
    }
  }

  const dinamicosAtuais = listarPerfis().length - PERFIS.length;

  return (
    <div
      ref={dialogoRef}
      role="dialog"
      aria-modal="true"
      aria-label={editando ? `gerenciar ${editando.identidade.nome}` : "criar novo jogador"}
      data-novo-jogador="true"
      tabIndex={-1}
      onKeyDown={prenderTab}
      className="fixed inset-0 z-40 flex flex-col bg-manu-nuvem px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] outline-none"
    >
      <PortaoParental
        aberto={passo === "portao"}
        onLiberado={() => setPasso(editando ? "dados" : "foto")}
        onCancelar={onFechar}
      />

      {passo !== "portao" ? (
        <>
          <div className="flex shrink-0 items-center justify-between">
            <h2 className="font-titulo text-2xl text-manu-cacau">
              {editando ? `Editar ${editando.identidade.apelido}` : "Novo jogador"}
            </h2>
            <button
              type="button"
              aria-label="fechar sem salvar"
              onClick={() => {
                feedback("toque");
                onFechar();
              }}
              className="bolha min-h-11 min-w-11 bg-manu-papel text-lg ring-2 ring-manu-cacau/10"
            >
              ✕
            </button>
          </div>

          {erro ? (
            <p data-erro="true" className="shrink-0 py-1 text-center font-titulo text-sm text-manu-rosa-texto">
              {erro}
            </p>
          ) : null}

          {passo === "foto" ? (
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4">
              <p className="text-center font-titulo text-lg text-manu-cacau">
                Foto do corpo inteiro
              </p>
              <p className="max-w-xs text-center text-xs text-manu-cacau-suave">
                Fundo branquinho fica melhor: a foto vira figurinha. Nada sai deste aparelho.
              </p>
              {processando ? (
                <p data-processando="true" className="anima-brilho font-titulo text-manu-cacau-suave">
                  Preparando a foto…
                </p>
              ) : null}
              <label className="bolha min-h-14 cursor-pointer bg-manu-sol px-6 font-titulo text-lg ring-2 ring-manu-sol-forte">
                Tirar foto
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  data-entrada-camera="true"
                  className="hidden"
                  onChange={(e) => void aoEscolherArquivo(e.target.files?.[0])}
                />
              </label>
              <label className="bolha min-h-14 cursor-pointer bg-manu-papel px-6 font-titulo text-lg ring-2 ring-manu-cacau/10">
                Escolher da galeria
                <input
                  type="file"
                  accept="image/*"
                  data-entrada-galeria="true"
                  className="hidden"
                  onChange={(e) => void aoEscolherArquivo(e.target.files?.[0])}
                />
              </label>
            </div>
          ) : null}

          {passo === "rosto" && corpo ? (
            <div className="flex min-h-0 flex-1 flex-col items-center gap-3 overflow-y-auto py-2">
              <p className="shrink-0 text-center font-titulo text-lg text-manu-cacau">
                Agora, o rosto: arraste o quadro
              </p>
              <div
                ref={quadroRef}
                className="relative w-full max-w-sm touch-none select-none"
                onPointerMove={aoPointerMove}
                onPointerUp={aoPointerUp}
                onPointerCancel={aoPointerUp}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={corpo.previa} alt="" className="w-full" draggable={false} />
                <div
                  data-recorte="true"
                  onPointerDown={(e) => aoPointerDown(e, "mover")}
                  className="absolute cursor-move rounded-xl border-4 border-manu-sol-forte bg-manu-sol/10"
                  style={{
                    left: `${(recorte.x / corpo.largura) * 100}%`,
                    top: `${(recorte.y / corpo.altura) * 100}%`,
                    width: `${(recorte.lado / corpo.largura) * 100}%`,
                    height: `${(recorte.lado / corpo.altura) * 100}%`,
                  }}
                >
                  <div
                    data-alca="true"
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      aoPointerDown(e, "tamanho");
                    }}
                    className="absolute -bottom-3 -right-3 h-8 w-8 cursor-nwse-resize rounded-full bg-manu-sol-forte"
                  />
                </div>
              </div>
              <div className="flex shrink-0 gap-3">
                <button
                  type="button"
                  aria-label="voltar para a foto"
                  onClick={() => {
                    feedback("toque");
                    setPasso("foto");
                  }}
                  className="bolha min-h-12 bg-manu-papel px-4 font-titulo ring-2 ring-manu-cacau/10"
                >
                  Trocar foto
                </button>
                <button
                  type="button"
                  aria-label="rosto escolhido, continuar"
                  onClick={() => {
                    feedback("abrir");
                    setPasso("dados");
                  }}
                  className="bolha min-h-12 bg-manu-sol px-6 font-titulo ring-2 ring-manu-sol-forte"
                >
                  Continuar
                </button>
              </div>
            </div>
          ) : null}

          {passo === "dados" || passo === "salvando" ? (
            <div className="flex min-h-0 flex-1 flex-col items-center gap-3 overflow-y-auto py-2">
              <label className="w-full max-w-sm">
                <span className="font-titulo text-sm text-manu-cacau">Nome</span>
                <input
                  type="text"
                  value={nome}
                  maxLength={20}
                  data-campo-nome="true"
                  onChange={(e) => setNome(e.target.value)}
                  className="mt-1 w-full rounded-2xl border-2 border-manu-cacau/20 bg-manu-papel px-4 py-3 font-titulo text-lg text-manu-cacau"
                />
              </label>
              <label className="w-full max-w-sm">
                <span className="font-titulo text-sm text-manu-cacau">
                  Apelido (como os jogos chamam)
                </span>
                <input
                  type="text"
                  value={apelido}
                  maxLength={20}
                  placeholder={nome.trim().split(/\s+/)[0] || "igual ao nome"}
                  data-campo-apelido="true"
                  onChange={(e) => setApelido(e.target.value)}
                  className="mt-1 w-full rounded-2xl border-2 border-manu-cacau/20 bg-manu-papel px-4 py-3 font-titulo text-lg text-manu-cacau"
                />
              </label>
              <div className="flex gap-3">
                {(
                  [
                    ["a", "Menina"],
                    ["o", "Menino"],
                  ] as const
                ).map(([g, rotulo]) => (
                  <button
                    key={g}
                    type="button"
                    aria-label={rotulo}
                    aria-pressed={genero === g}
                    data-genero={g}
                    onClick={() => {
                      feedback("toque");
                      setGenero(g);
                    }}
                    className={`bolha min-h-14 px-6 font-titulo text-lg ring-4 ${anelPorGenero(g)} ${
                      genero === g ? "bg-manu-papel" : "bg-manu-papel/50 opacity-60"
                    }`}
                  >
                    {rotulo}
                  </button>
                ))}
              </div>

              {corpo ? (
                <div className={`bolha flex min-h-40 w-40 flex-col items-center justify-end gap-2 bg-manu-papel p-3 ring-4 ${anelPorGenero(genero)}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={corpo.previa} alt="" className="h-24 w-auto object-contain" />
                  <span className="font-titulo text-manu-cacau">{nome.trim() || "…"}</span>
                </div>
              ) : editando ? (
                <div className={`bolha flex min-h-40 w-40 flex-col items-center justify-end gap-2 bg-manu-papel p-3 ring-4 ${anelPorGenero(genero)}`}>
                  <Image
                    src={editando.corpo.src}
                    alt=""
                    width={80}
                    height={120}
                    className="h-24 w-auto object-contain"
                    unoptimized
                  />
                  <span className="font-titulo text-manu-cacau">{nome.trim() || "…"}</span>
                </div>
              ) : null}

              <div className="flex shrink-0 flex-wrap items-center justify-center gap-3">
                {editando ? (
                  <>
                    <button
                      type="button"
                      aria-label="trocar a foto deste jogador"
                      onClick={() => {
                        feedback("toque");
                        setPasso("foto");
                      }}
                      className="bolha min-h-12 bg-manu-papel px-4 font-titulo ring-2 ring-manu-cacau/10"
                    >
                      Trocar foto
                    </button>
                    <button
                      type="button"
                      aria-label={`apagar o jogador ${editando.identidade.nome}`}
                      data-apagar="true"
                      onClick={() => {
                        feedback("toque");
                        setConfirmandoApagar(true);
                      }}
                      className="bolha min-h-12 bg-manu-rosa/40 px-4 font-titulo text-manu-rosa-texto ring-2 ring-manu-rosa"
                    >
                      Apagar
                    </button>
                  </>
                ) : null}
                <button
                  type="button"
                  aria-label={editando ? "salvar mudanças" : "criar jogador"}
                  data-salvar="true"
                  disabled={passo === "salvando" || (!editando && !corpo)}
                  onClick={() => void salvar()}
                  className="bolha min-h-14 bg-manu-sol px-8 font-titulo text-xl ring-2 ring-manu-sol-forte disabled:opacity-50"
                >
                  {passo === "salvando" ? "Salvando…" : editando ? "Salvar" : "Criar"}
                </button>
              </div>
              {!editando ? (
                <p className="shrink-0 text-center text-xs text-manu-cacau-suave">
                  {dinamicosAtuais} de {MAXIMO_DINAMICOS} jogadores criados
                </p>
              ) : null}
            </div>
          ) : null}

          {confirmandoApagar && editando ? (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-manu-nuvem/95 px-6">
              <p className="max-w-sm text-center font-titulo text-xl text-manu-cacau">
                Apagar {editando.identidade.nome}? Os jogos salvos e os desenhos
                {" "}
                {editando.identidade.genero === "a" ? "dela" : "dele"} vão junto.
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  aria-label="não apagar"
                  onClick={() => {
                    feedback("toque");
                    setConfirmandoApagar(false);
                  }}
                  className="bolha min-h-12 bg-manu-papel px-6 font-titulo ring-2 ring-manu-cacau/10"
                >
                  Voltar
                </button>
                <button
                  type="button"
                  aria-label={`sim, apagar ${editando.identidade.nome} e os salvamentos`}
                  data-apagar-confirmar="true"
                  onClick={() => void apagar()}
                  className="bolha min-h-12 bg-manu-rosa/50 px-6 font-titulo text-manu-rosa-texto ring-2 ring-manu-rosa"
                >
                  Apagar tudo
                </button>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
