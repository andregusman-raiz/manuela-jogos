"use client";

import Link from "next/link";
import { daMascote } from "@/lib/identidade";
import { useIdentidade } from "@/lib/usePerfil";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { BotaoBolha } from "@/components/ui-kids/BotaoBolha";
import { Confete } from "@/components/ui-kids/Confete";
import { Icone } from "@/components/ui-kids/Icone";
import { Mascote } from "@/components/ui-kids/Mascote";
import { lerProgresso, salvarProgresso } from "@/lib/armazenamento";
import {
  COMPRAS_POR_FASE,
  NIVEL_MAXIMO_LOJINHA,
  criarRng,
  devolverPeca,
  formatar,
  gerarRodada,
  proximoNivelLojinha,
  somaDe,
  tocarPeca,
} from "@/lib/lojinha/motor";
import type { NivelLojinha, RodadaLojinha } from "@/lib/lojinha/motor";
import { assinarMudo, definirMudo, estaMudo, feedback, mudoNoServidor, tocar } from "@/lib/som";

/**
 * Dinheiro ESTILIZADO (SPEC §3.3): retângulo/círculo com o valor — cores que
 * lembram as notas reais, desenho abstrato. NUNCA a arte do Banco Central.
 */
const COR_NOTA: Record<number, string> = {
  200: "#9bc0e8",
  500: "#c9a8e0",
  1000: "#e8a0a0",
  2000: "#f2d478",
};

function Peca({ valor }: { valor: number }) {
  const ehMoeda = valor < 200;
  if (ehMoeda) {
    return (
      <span
        aria-hidden
        className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-manu-sol-forte bg-manu-sol font-titulo text-xs text-manu-cacau"
      >
        {valor < 100 ? `${valor}c` : "R$1"}
      </span>
    );
  }
  return (
    <span
      aria-hidden
      className="flex h-9 w-14 items-center justify-center rounded-md border-2 border-manu-cacau/30 font-titulo text-sm text-manu-cacau"
      style={{ backgroundColor: COR_NOTA[valor] }}
    >
      {valor / 100}
    </span>
  );
}

function rotuloPeca(valor: number): string {
  if (valor === 25) return "moeda de 25 centavos";
  if (valor === 50) return "moeda de 50 centavos";
  if (valor === 100) return "moeda de 1 real";
  return `nota de ${valor / 100} reais`;
}

export function Lojinha() {
  const identidade = useIdentidade();
  const [nivel, setNivel] = useState<NivelLojinha | null>(null);
  const [rodada, setRodada] = useState<RodadaLojinha | null>(null);
  const [pilha, setPilha] = useState<number[]>([]);
  const [acertos, setAcertos] = useState(0);
  const [tremeu, setTremeu] = useState(0);
  const [negada, setNegada] = useState<{ opcao: number; chave: number } | null>(null);
  const [pagando, setPagando] = useState(false);
  // guarda SÍNCRONA contra pagamento duplo: dois cliques no mesmo tick veem
  // o mesmo estado React, mas não o mesmo ref
  const pagandoRef = useRef(false);
  const rng = useRef<(() => number) | null>(null);
  const mudo = useSyncExternalStore(assinarMudo, estaMudo, mudoNoServidor);

  useEffect(() => {
    rng.current = criarRng((Date.now() % 2147483647) || 1);
    void lerProgresso("lojinha").then((p) => {
      const n = Math.min(p?.nivel ?? 1, NIVEL_MAXIMO_LOJINHA) as NivelLojinha;
      setNivel(n);
      setRodada(gerarRodada(n, rng.current!));
    });
  }, []);

  const completa = acertos >= COMPRAS_POR_FASE;
  const soma = somaDe(pilha);

  useEffect(() => {
    if (!completa || nivel === null) return;
    tocar("vitoria");
    void salvarProgresso("lojinha", proximoNivelLojinha(nivel));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completa]);

  function proximaCompra() {
    if (!rng.current || nivel === null) return;
    pagandoRef.current = false;
    setPilha([]);
    setPagando(false);
    setNegada(null);
    setTremeu(0);
    setRodada(gerarRodada(nivel, rng.current));
  }

  function aoTocarPeca(valor: number) {
    if (!rodada || pagando || completa) return;
    const resultado = tocarPeca(pilha, valor, rodada.preco);
    if (resultado.estourou) {
      tocar("erro");
      setTremeu((t) => t + 1);
      return;
    }
    tocar("cor");
    setPilha(resultado.pilha);
  }

  function aoDevolver(indice: number) {
    if (pagando) return;
    tocar("desfazer");
    setPilha((p) => devolverPeca(p, indice));
  }

  function aoPagar() {
    if (!rodada || pagandoRef.current || soma !== rodada.preco) return;
    pagandoRef.current = true;
    setPagando(true);
    tocar("acerto");
    setAcertos((a) => a + 1);
    if (acertos + 1 < COMPRAS_POR_FASE) setTimeout(proximaCompra, 900);
  }

  function aoResponderTroco(opcao: number) {
    if (!rodada?.pagamento || pagandoRef.current || completa) return;
    if (opcao === rodada.pagamento - rodada.preco) {
      pagandoRef.current = true;
      setPagando(true);
      tocar("acerto");
      setNegada(null);
      setAcertos((a) => a + 1);
      if (acertos + 1 < COMPRAS_POR_FASE) setTimeout(proximaCompra, 900);
    } else {
      tocar("erro");
      setNegada((atual) => ({ opcao, chave: (atual?.chave ?? 0) + 1 }));
    }
  }

  function novaFase(n: NivelLojinha) {
    pagandoRef.current = false;
    setNivel(n);
    setAcertos(0);
    setPilha([]);
    setPagando(false);
    setNegada(null);
    setTremeu(0);
    if (rng.current) setRodada(gerarRodada(n, rng.current));
  }

  const nivel3 = rodada?.pagamento !== undefined;

  return (
    <main data-nivel={nivel ?? 0} className="flex h-[100dvh] flex-col overflow-hidden">
      <header className="flex h-16 shrink-0 items-center gap-2 px-2 pt-[env(safe-area-inset-top)] deitado:h-12">
        <Link
          href="/"
          aria-label="voltar para os jogos"
          onPointerDown={() => feedback("toque")}
          className="bolha h-14 min-h-14 w-14 min-w-14 overflow-hidden bg-manu-rosa/40 ring-2 ring-manu-rosa"
        >
          <Mascote pose="rosto" tamanho={56} className="h-14 w-14 object-cover" />
        </Link>
        <h1 className="hidden font-titulo text-xl text-manu-cacau sm:block">{`Lojinha ${daMascote(identidade)}`}</h1>
        {nivel !== null ? (
          <span className="rounded-full bg-manu-pele px-3 py-1 font-titulo text-sm text-manu-cacau">
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

      {rodada ? (
        <div
          aria-label={`${Math.min(acertos, COMPRAS_POR_FASE)} de ${COMPRAS_POR_FASE} compras`}
          data-acertos={acertos}
          className="flex shrink-0 justify-center gap-1 py-1"
        >
          {Array.from({ length: COMPRAS_POR_FASE }, (_, i) => (
            <span key={i} className={i < acertos ? "" : "opacity-20"}>
              <Icone nome="estrela" tamanho={22} />
            </span>
          ))}
        </div>
      ) : null}

      <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-3">
        {rodada && !completa ? (
          <>
            <span aria-hidden className="text-7xl drop-shadow-sm">
              {rodada.produto.emoji}
            </span>
            <p
              data-preco={rodada.preco}
              data-pagamento={rodada.pagamento ?? ""}
              className="text-center font-titulo text-2xl text-manu-cacau"
            >
              {rodada.produto.nome} — <span className="text-manu-rosa-texto">{formatar(rodada.preco)}</span>
            </p>

            {nivel3 ? (
              <p className="text-center font-titulo text-xl text-manu-cacau-suave">
                Você pagou com {formatar(rodada.pagamento!)}.
                <br />
                Quanto volta de troco?
              </p>
            ) : (
              <div
                key={`visor-${tremeu}`}
                data-soma={soma}
                aria-label={`já pagou ${formatar(soma)}`}
                className={`flex min-h-16 w-full max-w-sm flex-wrap items-center justify-center gap-1 rounded-2xl bg-manu-papel p-2 ring-2 ring-manu-cacau/10 ${
                  tremeu > 0 ? "anima-nao" : ""
                }`}
              >
                {pilha.length === 0 ? (
                  <span className="font-titulo text-sm text-manu-cacau-suave">
                    Toque no dinheiro para pagar
                  </span>
                ) : (
                  pilha.map((valor, i) => (
                    <button
                      key={`${i}-${valor}`}
                      type="button"
                      aria-label={`devolver ${rotuloPeca(valor)}`}
                      disabled={pagando}
                      onClick={() => aoDevolver(i)}
                      className="rounded-lg p-0.5 active:scale-95 disabled:opacity-60"
                    >
                      <Peca valor={valor} />
                    </button>
                  ))
                )}
                <span className="ml-2 font-titulo text-xl text-manu-cacau">{formatar(soma)}</span>
              </div>
            )}
          </>
        ) : null}

        {completa && nivel !== null ? (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-manu-nuvem/95 px-4">
            <Mascote pose="comemorando" tamanho={150} className="h-36 w-auto drop-shadow-md" />
            <p className="text-center font-titulo text-3xl text-manu-cacau">Loja fechada, tudo vendido!</p>
            <div className="flex flex-wrap justify-center gap-4">
              <BotaoBolha rotulo="jogar de novo" tamanho="xl" onClick={() => novaFase(nivel)}>
                <span className="px-3 font-titulo text-2xl">De novo</span>
              </BotaoBolha>
              {nivel < NIVEL_MAXIMO_LOJINHA ? (
                <BotaoBolha
                  rotulo="mais difícil"
                  tamanho="xl"
                  efeito="abrir"
                  onClick={() => novaFase(proximoNivelLojinha(nivel))}
                  className="bg-manu-sol"
                >
                  <span className="px-3 font-titulo text-2xl">Mais difícil</span>
                </BotaoBolha>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      {rodada && !completa ? (
        nivel3 ? (
          <div className="grid shrink-0 grid-cols-4 gap-3 px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-1">
            {rodada.opcoesTroco!.map((opcao) => (
              <span
                key={`${rodada.preco}-${opcao}-${negada?.opcao === opcao ? negada.chave : 0}`}
                className={`block ${negada?.opcao === opcao ? "anima-nao" : ""}`}
              >
                <BotaoBolha
                  rotulo={`troco ${formatar(opcao)}`}
                  onClick={() => aoResponderTroco(opcao)}
                  desabilitado={pagando}
                  className="w-full"
                >
                  <span className="font-titulo text-lg">{formatar(opcao)}</span>
                </BotaoBolha>
              </span>
            ))}
          </div>
        ) : (
          <div className="shrink-0 px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-1">
            <div className="flex flex-wrap items-center justify-center gap-2">
              {rodada.pecas.map((valor) => (
                <BotaoBolha
                  key={valor}
                  rotulo={rotuloPeca(valor)}
                  onClick={() => aoTocarPeca(valor)}
                  desabilitado={pagando}
                  efeito="carimbo"
                >
                  <Peca valor={valor} />
                </BotaoBolha>
              ))}
              <BotaoBolha
                rotulo="pagar"
                tamanho="xl"
                efeito="abrir"
                onClick={aoPagar}
                desabilitado={pagando || soma !== rodada.preco}
                className="bg-manu-grama"
              >
                <span className="px-2 font-titulo text-xl">Pagar</span>
              </BotaoBolha>
            </div>
          </div>
        )
      ) : null}

      <Confete gatilho={completa ? 1 : 0} duracao={1800} />
    </main>
  );
}
