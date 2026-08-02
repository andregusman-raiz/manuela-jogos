"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { BotaoBolha } from "@/components/ui-kids/BotaoBolha";
import { Confete } from "@/components/ui-kids/Confete";
import { Icone } from "@/components/ui-kids/Icone";
import { Mascote } from "@/components/ui-kids/Mascote";
import { atualizarRegistro, lerRegistro, salvarProgresso } from "@/lib/armazenamento";
import {
  contar,
  estadoInicial,
  mover,
  movimentosLegais,
  pararCadeia,
} from "@/lib/damas/motor";
import type { Casa, EstadoDamas } from "@/lib/damas/motor";
import { assinarMudo, definirMudo, estaMudo, feedback, mudoNoServidor, tocar } from "@/lib/som";

type Placar = { id: "placar"; rosa: number; azul: number; atualizadoEm: number };

/**
 * Damas para DOIS no mesmo aparelho — SPEC onda 3 §3.4, regras da casa
 * (capturas livres e encadeáveis; promoção encerra a jogada; sem IA no v1).
 * O tabuleiro nunca persiste; só o PLACAR, via atualizarRegistro (incremento
 * transacional — duas abas somam, nunca sobrescrevem).
 */
export function Damas() {
  const [estado, setEstado] = useState<EstadoDamas>(estadoInicial);
  const [selecionada, setSelecionada] = useState<Casa | null>(null);
  const [placar, setPlacar] = useState<{ rosa: number; azul: number }>({ rosa: 0, azul: 0 });
  const [comecou, setComecou] = useState(false);
  const contabilizada = useRef(false);
  const mudo = useSyncExternalStore(assinarMudo, estaMudo, mudoNoServidor);

  useEffect(() => {
    // LEITURA pura do placar — atualizarRegistro aqui criava um registro
    // zerado só de visitar a página (review do PR D)
    void lerRegistro<Placar>("damas", "placar").then((registro) => {
      if (registro) setPlacar({ rosa: registro.rosa, azul: registro.azul });
    });
  }, []);

  const vencedor = estado.vencedor;

  useEffect(() => {
    if (!vencedor || contabilizada.current) return;
    contabilizada.current = true;
    tocar("vitoria");
    void salvarProgresso("damas", 1);
    void atualizarRegistro<Placar>("damas", "placar", (atual) => {
      const registro = atual ?? { id: "placar", rosa: 0, azul: 0, atualizadoEm: 0 };
      const novo = {
        ...registro,
        [vencedor]: registro[vencedor] + 1,
        atualizadoEm: Date.now(),
      };
      setPlacar({ rosa: novo.rosa, azul: novo.azul });
      return novo;
    });
  }, [vencedor]);

  function aoTocarCasa(linha: number, coluna: number) {
    if (vencedor) return;
    const peca = estado.tabuleiro[linha][coluna];

    if (selecionada) {
      const legais = movimentosLegais(estado, selecionada);
      const escolhido = legais.find((m) => m.para.linha === linha && m.para.coluna === coluna);
      if (escolhido) {
        const depois = mover(estado, escolhido);
        tocar(escolhido.captura ? "acerto" : "passo");
        setEstado(depois);
        setSelecionada(depois.cadeia ? depois.cadeia : null);
        return;
      }
    }
    if (peca && peca.cor === estado.vez) {
      if (estado.cadeia && (estado.cadeia.linha !== linha || estado.cadeia.coluna !== coluna)) {
        tocar("erro");
        return;
      }
      tocar("toque");
      setSelecionada({ linha, coluna });
      return;
    }
    setSelecionada(estado.cadeia);
  }

  function novaPartida() {
    contabilizada.current = false;
    setEstado(estadoInicial());
    setSelecionada(null);
  }

  const destinos = selecionada ? movimentosLegais(estado, selecionada) : [];
  const corVez = estado.vez === "rosa" ? "ring-manu-rosa-forte" : "ring-manu-ceu";

  return (
    <main
      data-vez={estado.vez}
      data-pecas-rosa={contar(estado, "rosa")}
      data-pecas-azul={contar(estado, "azul")}
      className={`flex h-[100dvh] flex-col overflow-hidden ${
        comecou && !vencedor ? `ring-8 ring-inset ${corVez}` : ""
      }`}
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
        <h1 className="hidden font-titulo text-xl text-manu-cacau sm:block">Damas</h1>
        <span
          data-placar-rosa={placar.rosa}
          data-placar-azul={placar.azul}
          className="rounded-full bg-manu-nuvem px-3 py-1 font-titulo text-sm text-manu-cacau ring-2 ring-manu-cacau/10"
        >
          Rosa {placar.rosa} × {placar.azul} Azul
        </span>
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

      {!comecou ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 px-6">
          <Mascote pose="corpo" tamanho={130} className="h-36 w-auto drop-shadow-md" />
          <div className="max-w-sm rounded-2xl bg-manu-papel p-4 text-sm text-manu-cacau ring-2 ring-manu-cacau/10">
            <p className="mb-1 font-titulo text-lg">Regras da casa</p>
            <p>
              A peça anda 1 casa na diagonal, pra frente. Pula por cima para capturar (pra frente
              OU pra trás) e pode emendar vários pulos — mas capturar nunca é obrigatório: o botão
              &quot;parar aqui&quot; encerra a sequência quando você quiser. Chegou do outro lado?
              Vira dama ★ (e a jogada termina); a dama anda 1 casa em QUALQUER diagonal. Quem
              ficar sem peças ou sem jogadas perde.
            </p>
          </div>
          <BotaoBolha rotulo="começar a partida" tamanho="xl" efeito="abrir" onClick={() => setComecou(true)}>
            <span className="px-4 font-titulo text-2xl">Jogar ▶</span>
          </BotaoBolha>
        </div>
      ) : (
        <>
          <p className="shrink-0 py-1 text-center font-titulo text-lg text-manu-cacau-suave">
            {vencedor
              ? `Venceu: ${vencedor === "rosa" ? "Rosa" : "Azul"}!`
              : `Vez de ${estado.vez === "rosa" ? "Rosa" : "Azul"}`}
          </p>

          <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 pb-1">
            <div
              className={`grid aspect-square max-h-full w-full max-w-[min(94vw,58dvh)] grid-cols-8 overflow-hidden rounded-xl ring-4 ${corVez}`}
            >
              {estado.tabuleiro.map((linhaCasas, linha) =>
                linhaCasas.map((peca, coluna) => {
                  const escura = (linha + coluna) % 2 === 1;
                  const destino = destinos.some(
                    (m) => m.para.linha === linha && m.para.coluna === coluna,
                  );
                  const marcada =
                    selecionada?.linha === linha && selecionada?.coluna === coluna;
                  return (
                    <button
                      key={`${linha}-${coluna}`}
                      type="button"
                      data-casa={`${linha}-${coluna}`}
                      data-destino={destino ? "true" : "false"}
                      aria-label={`casa ${linha + 1} ${coluna + 1}${
                        peca ? `, peça ${peca.cor}${peca.dama ? " dama" : ""}` : ""
                      }`}
                      onClick={() => aoTocarCasa(linha, coluna)}
                      className={`relative flex items-center justify-center ${
                        escura ? "bg-manu-cacau/25" : "bg-manu-nuvem"
                      } ${destino ? "ring-4 ring-inset ring-manu-grama" : ""} ${
                        marcada ? "ring-4 ring-inset ring-manu-sol-forte" : ""
                      }`}
                    >
                      {peca ? (
                        <span
                          data-cor={peca.cor}
                          data-dama={peca.dama ? "true" : "false"}
                          className={`flex h-3/4 w-3/4 items-center justify-center rounded-full font-titulo text-xs shadow-[0_2px_0_0_rgba(0,0,0,0.2)] ${
                            peca.cor === "rosa"
                              ? "bg-manu-rosa ring-2 ring-manu-rosa-forte"
                              : "bg-manu-ceu ring-2 ring-manu-cacau/30"
                          }`}
                        >
                          {peca.dama ? "★" : ""}
                        </span>
                      ) : null}
                    </button>
                  );
                }),
              )}
            </div>

            {vencedor ? (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-manu-nuvem/95 px-4">
                <Mascote pose="comemorando" tamanho={150} className="h-36 w-auto drop-shadow-md" />
                <p className="text-center font-titulo text-3xl text-manu-cacau">
                  {vencedor === "rosa" ? "Rosa" : "Azul"} venceu!
                </p>
                <BotaoBolha rotulo="jogar de novo" tamanho="xl" onClick={novaPartida}>
                  <span className="px-3 font-titulo text-2xl">De novo</span>
                </BotaoBolha>
              </div>
            ) : null}
          </div>

          <div className="flex min-h-12 shrink-0 items-center justify-center pb-[max(0.5rem,env(safe-area-inset-bottom))]">
            {estado.cadeia ? (
              <BotaoBolha rotulo="parar aqui" efeito="abrir" onClick={() => {
                tocar("passo");
                setEstado(pararCadeia(estado));
                setSelecionada(null);
              }}>
                <span className="px-2 font-titulo text-lg">Parar aqui</span>
              </BotaoBolha>
            ) : null}
          </div>
        </>
      )}

      <Confete gatilho={vencedor ? 1 : 0} duracao={1800} />
    </main>
  );
}
