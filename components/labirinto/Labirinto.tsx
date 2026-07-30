"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { BotaoBolha } from "@/components/ui-kids/BotaoBolha";
import { Confete } from "@/components/ui-kids/Confete";
import { Icone } from "@/components/ui-kids/Icone";
import { Manu } from "@/components/ui-kids/Manu";
import { lerProgresso, salvarProgresso } from "@/lib/armazenamento";
import { FASES } from "@/lib/labirinto/dados";
import { FILA_MAXIMA, executar, posicaoInicial } from "@/lib/labirinto/motor";
import type { Comando, Posicao } from "@/lib/labirinto/tipos";
import { assinarMudo, definirMudo, estaMudo, feedback, mudoNoServidor, tocar } from "@/lib/som";

const SETAS: Record<Comando, string> = {
  frente: "⬆",
  "girar-esquerda": "⟲",
  "girar-direita": "⟳",
};
const ROTULOS: Record<Comando, string> = {
  frente: "andar para frente",
  "girar-esquerda": "girar para a esquerda",
  "girar-direita": "girar para a direita",
};
/** A seta fica ENCOSTADA no lado da célula para onde a Manu vai andar. */
const SETA_DIRECAO: Record<string, string> = {
  norte: "top-0 left-1/2 -translate-x-1/2",
  leste: "right-0 top-1/2 -translate-y-1/2 rotate-90",
  sul: "bottom-0 left-1/2 -translate-x-1/2 rotate-180",
  oeste: "left-0 top-1/2 -translate-y-1/2 -rotate-90",
};

/**
 * Labirinto da Manu — pré-programação por fila de comandos (SPEC §4.3).
 * Giro é PURO (não avança); a Manu mostra a direção o tempo todo pela seta.
 * Bater na parede nunca apaga a fila: volta ao início para editar.
 */
export function Labirinto() {
  const [faseIndice, setFaseIndice] = useState<number | null>(null);
  const [fila, setFila] = useState<Comando[]>([]);
  const [passos, setPassos] = useState<Posicao[] | null>(null); // executando quando != null
  const [passoAtual, setPassoAtual] = useState(-1);
  const [vitorias, setVitorias] = useState(0); // gatilho do confete
  const [negacao, setNegacao] = useState(0); // shake da Manu ao bater
  const resultado = useRef<"estrela" | "parede" | "fim-da-fila" | null>(null);
  const mudo = useSyncExternalStore(assinarMudo, estaMudo, mudoNoServidor);

  useEffect(() => {
    void lerProgresso("labirinto").then((p) => {
      setFaseIndice(Math.min(Math.max((p?.nivel ?? 1) - 1, 0), FASES.length - 1));
    });
  }, []);

  const fase = faseIndice === null ? null : FASES[faseIndice];
  const executando = passos !== null;

  // Um passo a cada 450ms; ao terminar, aplica o resultado REAL do motor.
  useEffect(() => {
    if (!passos) return;
    if (passoAtual < passos.length - 1) {
      const t = setTimeout(() => {
        tocar("passo");
        setPassoAtual((p) => p + 1);
      }, 450);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => {
      if (resultado.current === "estrela") {
        tocar("vitoria");
        setVitorias((v) => v + 1);
        setFila([]);
        setFaseIndice((i) => {
          const proxima = Math.min((i ?? 0) + 1, FASES.length - 1);
          void salvarProgresso("labirinto", proxima + 1);
          return proxima;
        });
      } else {
        // parede ou fila curta: shake + som suave, posição volta, FILA FICA
        tocar("erro");
        setNegacao((n) => n + 1);
      }
      resultado.current = null;
      setPassos(null);
      setPassoAtual(-1);
    }, 500);
    return () => clearTimeout(t);
  }, [passos, passoAtual]);

  function adicionar(comando: Comando) {
    if (executando) return;
    setFila((f) => {
      if (f.length >= FILA_MAXIMA) {
        tocar("vazio");
        return f;
      }
      return [...f, comando];
    });
  }

  function removerDaFila(indice: number) {
    if (executando) return;
    setFila((f) => f.filter((_, i) => i !== indice));
  }

  function rodar() {
    if (!fase || executando || fila.length === 0) return;
    const execucao = executar(fase, fila);
    resultado.current = execucao.resultado;
    setPassos(execucao.passos);
    setPassoAtual(-1);
  }

  const posicao: Posicao | null = fase
    ? passos && passoAtual >= 0
      ? passos[passoAtual]
      : posicaoInicial(fase)
    : null;

  return (
    <main
      data-fase={faseIndice === null ? 0 : faseIndice + 1}
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
        <h1 className="hidden font-titulo text-xl text-manu-cacau sm:block">Labirinto da Manu</h1>
        {faseIndice !== null ? (
          <span className="rounded-full bg-manu-grama px-3 py-1 font-titulo text-sm text-manu-cacau">
            Fase {faseIndice + 1}
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

      {fase && posicao ? (
        <>
          <div className="flex min-h-0 flex-1 items-center justify-center px-3">
            <div
              key={`fase-${faseIndice}-${negacao}`}
              className={`grid aspect-square w-full max-w-[min(92vw,52dvh)] gap-1 ${negacao > 0 ? "anima-nao" : ""}`}
              style={{
                gridTemplateColumns: `repeat(${fase.grade[0].length}, minmax(0, 1fr))`,
              }}
            >
              {fase.grade.flatMap((linha, y) =>
                [...linha].map((celula, x) => {
                  const manuAqui = posicao.x === x && posicao.y === y;
                  return (
                    <div
                      key={`${x},${y}`}
                      data-celula={celula === "#" ? "parede" : "livre"}
                      className={`relative flex items-center justify-center rounded-lg ${
                        celula === "#" ? "bg-manu-cacau/25" : "bg-manu-papel/70"
                      }`}
                    >
                      {celula === "E" && !manuAqui ? (
                        <span aria-hidden className="text-2xl sm:text-3xl">
                          ⭐
                        </span>
                      ) : null}
                      {manuAqui ? (
                        <span
                          data-pos={`${x},${y}`}
                          data-direcao={posicao.direcao}
                          aria-label={`Manu olhando para ${posicao.direcao}`}
                          className="relative flex h-full w-full items-center justify-center"
                        >
                          <Manu pose="rosto" tamanho={48} className="h-3/4 w-3/4 object-contain" />
                          <span
                            aria-hidden
                            className={`absolute font-titulo text-lg leading-none text-manu-rosa-forte drop-shadow-sm ${SETA_DIRECAO[posicao.direcao]}`}
                          >
                            ▲
                          </span>
                        </span>
                      ) : null}
                    </div>
                  );
                }),
              )}
            </div>
          </div>

          <div
            aria-label="fila de comandos"
            data-fila={fila.length}
            className="flex min-h-12 shrink-0 flex-wrap items-center justify-center gap-1 px-3 py-1"
          >
            {fila.length === 0 ? (
              <span className="font-titulo text-sm text-manu-cacau-suave">
                Monte o caminho e aperte ▶
              </span>
            ) : (
              fila.map((comando, i) => (
                <button
                  key={`${i}-${comando}`}
                  type="button"
                  aria-label={`tirar o comando ${i + 1}: ${ROTULOS[comando]}`}
                  onPointerDown={() => feedback("toque")}
                  onClick={() => removerDaFila(i)}
                  className="bolha min-h-11 min-w-11 bg-manu-ceu-claro text-xl ring-2 ring-manu-ceu"
                >
                  {SETAS[comando]}
                </button>
              ))
            )}
          </div>

          <div className="flex shrink-0 items-center justify-center gap-3 px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-1">
            {(Object.keys(SETAS) as Comando[]).map((comando) => (
              <BotaoBolha
                key={comando}
                rotulo={ROTULOS[comando]}
                onClick={() => adicionar(comando)}
                desabilitado={executando}
              >
                {SETAS[comando]}
              </BotaoBolha>
            ))}
            <BotaoBolha
              rotulo="executar os comandos"
              tamanho="xl"
              efeito="abrir"
              onClick={rodar}
              desabilitado={executando || fila.length === 0}
              className="bg-manu-grama"
            >
              ▶
            </BotaoBolha>
          </div>
        </>
      ) : null}

      <Confete gatilho={vitorias} duracao={1800} />
    </main>
  );
}
