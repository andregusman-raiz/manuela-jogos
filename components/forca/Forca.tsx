"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { BotaoBolha } from "@/components/ui-kids/BotaoBolha";
import { Confete } from "@/components/ui-kids/Confete";
import { Icone } from "@/components/ui-kids/Icone";
import { Manu } from "@/components/ui-kids/Manu";
import { lerProgresso, salvarProgresso } from "@/lib/armazenamento";
import {
  ERROS_MAXIMOS,
  GANHAS_PARA_SUBIR,
  PALAVRAS_POR_FASE,
  avancar,
  base,
  gerarFase,
  palavraAtual,
  tentar,
} from "@/lib/forca/motor";
import type { EstadoForca, NivelForca } from "@/lib/forca/motor";
import { assinarMudo, definirMudo, estaMudo, feedback, mudoNoServidor, tocar } from "@/lib/som";

const TECLADO = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

/**
 * Forca da Manu — versão amigável (SPEC onda 2 §3.1): 6 balões estouram nos
 * erros; perder revela a palavra e a fila AVANÇA. Acentos vêm de graça
 * (casamento por letra-base NFD). Fase fecha em 6 palavras, ganhas ou não.
 */
export function Forca() {
  const [estado, setEstado] = useState<EstadoForca | null>(null);
  const seed = useRef(1);
  const mudo = useSyncExternalStore(assinarMudo, estaMudo, mudoNoServidor);

  useEffect(() => {
    seed.current = (Date.now() % 2147483647) || 1;
    void lerProgresso("forca").then((p) => {
      const nivel = Math.min(p?.nivel ?? 1, 2) as NivelForca;
      setEstado(gerarFase(nivel, seed.current));
    });
  }, []);

  const situacao = estado?.situacao;

  // Interstício de 1.4s mostrando a palavra completa; depois a fila anda.
  useEffect(() => {
    if (situacao !== "ganhou-palavra" && situacao !== "perdeu-palavra") return;
    tocar(situacao === "ganhou-palavra" ? "acerto" : "vazio");
    const t = setTimeout(() => setEstado((e) => (e ? avancar(e) : e)), 1400);
    return () => clearTimeout(t);
  }, [situacao]);

  useEffect(() => {
    if (!estado || situacao !== "fase-completa") return;
    tocar("vitoria");
    if (estado.ganhas >= GANHAS_PARA_SUBIR && estado.nivel === 1) {
      void salvarProgresso("forca", 2);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [situacao]);

  function aoTeclar(letra: string) {
    // Fora do updater: efeito colateral em updater não é puro (StrictMode
    // reinvoca e o som sairia dobrado). Handler roda 1x por toque real.
    if (!estado) return;
    const proximo = tentar(estado, letra);
    if (proximo === estado) return;
    const acertou = [...palavraAtual(estado).palavra].some((c) => base(c) === letra);
    tocar(acertou ? "cor" : "erro");
    setEstado(proximo);
  }

  function novaFase(nivel: NivelForca) {
    seed.current = (seed.current * 16807) % 2147483647 || 1;
    setEstado(gerarFase(nivel, seed.current));
  }

  const atual = estado && estado.situacao !== "fase-completa" ? palavraAtual(estado) : null;
  const emIntersticio = situacao === "ganhou-palavra" || situacao === "perdeu-palavra";

  return (
    <main data-nivel={estado?.nivel ?? 0} className="flex h-[100dvh] flex-col overflow-hidden">
      <header className="flex h-16 shrink-0 items-center gap-2 px-2 pt-[env(safe-area-inset-top)] deitado:h-12">
        <Link
          href="/"
          aria-label="voltar para os jogos"
          onPointerDown={() => feedback("toque")}
          className="bolha h-14 min-h-14 w-14 min-w-14 overflow-hidden bg-manu-rosa/40 ring-2 ring-manu-rosa"
        >
          <Manu pose="rosto" tamanho={56} className="h-14 w-14 object-cover" />
        </Link>
        <h1 className="hidden font-titulo text-xl text-manu-cacau sm:block">Forca da Manu</h1>
        {estado ? (
          <span className="rounded-full bg-manu-ceu-claro px-3 py-1 font-titulo text-sm text-manu-cacau">
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

      {estado ? (
        <div
          aria-label={`${estado.ganhas} palavras acertadas de ${estado.jogadas} jogadas`}
          data-ganhas={estado.ganhas}
          data-jogadas={estado.jogadas}
          className="flex shrink-0 justify-center gap-1 py-1"
        >
          {Array.from({ length: PALAVRAS_POR_FASE }, (_, i) => (
            <span key={i} className={i < estado.jogadas ? "" : "opacity-20"}>
              <Icone nome="estrela" tamanho={20} />
            </span>
          ))}
        </div>
      ) : null}

      {estado && atual ? (
        <>
          <div
            aria-label={`${ERROS_MAXIMOS - estado.erros} balões restantes`}
            data-erros={estado.erros}
            className="flex shrink-0 justify-center gap-1 text-2xl"
          >
            {Array.from({ length: ERROS_MAXIMOS }, (_, i) => (
              <span key={i} aria-hidden className={i < estado.erros ? "opacity-15 grayscale" : ""}>
                🎈
              </span>
            ))}
          </div>

          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-3">
            <span aria-hidden className="text-7xl drop-shadow-sm">
              {atual.emoji}
            </span>
            <p
              data-palavra={atual.palavra}
              className="flex flex-wrap items-end justify-center gap-1 px-2 font-titulo text-4xl tracking-wide text-manu-cacau"
            >
              {[...atual.palavra].map((c, i) => {
                const revelada = estado.usadas.includes(base(c)) || emIntersticio;
                return (
                  <span
                    key={i}
                    className={`inline-block min-w-8 border-b-4 text-center ${
                      revelada
                        ? situacao === "perdeu-palavra"
                          ? "anima-entrada border-manu-rosa-forte text-manu-rosa-forte"
                          : "border-manu-grama"
                        : "border-manu-cacau/30 text-transparent"
                    }`}
                  >
                    {revelada ? c : "•"}
                  </span>
                );
              })}
            </p>
            {emIntersticio ? (
              <p className="font-titulo text-lg text-manu-cacau-suave">
                {situacao === "ganhou-palavra" ? "Muito bem!" : `Era ${atual.palavra}!`}
              </p>
            ) : null}
          </div>

          <div className="mx-auto grid w-full max-w-[340px] shrink-0 grid-cols-6 gap-1.5 px-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {TECLADO.map((letra) => {
              const usada = estado.usadas.includes(letra);
              const acertou = usada && [...atual.palavra].some((c) => base(c) === letra);
              return (
                <button
                  key={letra}
                  type="button"
                  aria-label={`letra ${letra}`}
                  disabled={usada || emIntersticio}
                  onPointerDown={() => {
                    if (!usada && !emIntersticio) feedback("toque");
                  }}
                  onClick={() => aoTeclar(letra)}
                  className={`bolha min-h-12 min-w-12 font-titulo text-lg ${
                    usada
                      ? acertou
                        ? "bg-manu-grama opacity-60"
                        : "bg-manu-rosa/50 opacity-40"
                      : "bg-manu-papel ring-2 ring-manu-cacau/10"
                  }`}
                >
                  {letra}
                </button>
              );
            })}
          </div>
        </>
      ) : null}

      {estado?.situacao === "fase-completa" ? (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-manu-nuvem/95 px-4">
          <Manu pose="comemorando" tamanho={150} className="h-36 w-auto drop-shadow-md" />
          <p className="text-center font-titulo text-3xl text-manu-cacau">
            Você acertou {estado.ganhas} de {PALAVRAS_POR_FASE}!
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <BotaoBolha rotulo="jogar de novo" tamanho="xl" onClick={() => novaFase(estado.nivel)}>
              <span className="px-3 font-titulo text-2xl">De novo</span>
            </BotaoBolha>
            {estado.nivel === 1 && estado.ganhas >= GANHAS_PARA_SUBIR ? (
              <BotaoBolha
                rotulo="mais difícil"
                tamanho="xl"
                efeito="abrir"
                onClick={() => novaFase(2)}
                className="bg-manu-sol"
              >
                <span className="px-3 font-titulo text-2xl">Mais difícil</span>
              </BotaoBolha>
            ) : null}
          </div>
        </div>
      ) : null}

      <Confete gatilho={estado?.situacao === "fase-completa" ? 1 : 0} duracao={1800} />
    </main>
  );
}
