"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { CardJogo } from "@/components/hub/CardJogo";
import { EscolhaJogador } from "@/components/hub/EscolhaJogador";
import { criarJogos } from "@/lib/jogos";
import { assinarJogador, jogadorNoServidor, lerJogador, limparJogador } from "@/lib/perfis";
import { useIdentidade, useRegistroPronto } from "@/lib/usePerfil";
import { assinarOcultos, lerOcultos, ocultosNoServidor, salvarOcultos } from "@/lib/preferencias";
import { feedback, tocar } from "@/lib/som";

/**
 * Grade do hub + botão de configurações: o adulto escolhe quais jogos aparecem
 * na tela inicial. A escolha vive em localStorage; esconder NUNCA apaga
 * progresso e a rota continua acessível por link direto.
 */
export function GradeJogos() {
  // SSR renderiza a grade completa (snapshot do servidor = nada oculto);
  // o filtro real entra na hidratação — padrão do mudo em lib/som.ts
  const escondidos = useSyncExternalStore(assinarOcultos, lerOcultos, ocultosNoServidor);
  // SSR assume jogador escolhido (o caso comum); primeira visita mostra a
  // tela "Quem vai jogar?" na hidratação
  const jogador = useSyncExternalStore(assinarJogador, lerJogador, jogadorNoServidor);
  const identidade = useIdentidade();
  const jogos = criarJogos(identidade);
  const [configurando, setConfigurando] = useState(false);
  const [negada, setNegada] = useState(0);

  // o véu anti-FOUC só sai quando o CATÁLOGO validou o id salvo (SPEC
  // perfis-pela-interface §1.2: id dinâmico apagado → picker sem flash)
  const pronto = useRegistroPronto();
  useEffect(() => {
    if (pronto) document.documentElement.removeAttribute("data-sem-jogador");
  }, [pronto]);

  useEffect(() => {
    if (!negada) return;
    const t = setTimeout(() => setNegada(0), 500);
    return () => clearTimeout(t);
  }, [negada]);

  const visiveis = jogos.filter((jogo) => !escondidos.includes(jogo.id));

  function alternar(id: string) {
    const escondendo = !escondidos.includes(id);
    // pelo menos 1 jogo fica: esconder o último visível é negado com um "não"
    if (escondendo && visiveis.length === 1) {
      tocar("erro");
      setNegada((n) => n + 1);
      return;
    }
    feedback("toque");
    salvarOcultos(escondendo ? [...escondidos, id] : escondidos.filter((o) => o !== id));
  }

  if (jogador === null) return <EscolhaJogador />;

  return (
    <>
      <div className="mt-1 grid flex-1 auto-rows-fr grid-cols-5 gap-1.5 sm:gap-4">
        {visiveis.map((jogo) => (
          <CardJogo key={jogo.id} jogo={jogo} />
        ))}
      </div>

      <div className="mt-auto flex items-center justify-center gap-2 pt-2">
        <p className="text-center text-xs text-manu-cacau-suave">
          Sem anúncios, sem cadastro. Tudo fica só neste aparelho.
        </p>
        <button
          type="button"
          aria-label="escolher os jogos da tela inicial"
          data-config="true"
          onClick={() => {
            feedback("toque");
            setConfigurando(true);
          }}
          className="bolha min-h-11 min-w-11 bg-manu-papel text-lg ring-2 ring-manu-cacau/10"
        >
          ⚙️
        </button>
      </div>

      {configurando ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="escolher os jogos da tela inicial"
          className="fixed inset-0 z-20 flex flex-col bg-manu-nuvem px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]"
        >
          <h2 className="shrink-0 py-2 text-center font-titulo text-2xl text-manu-cacau">
            Quais jogos aparecem?
          </h2>
          <p className="shrink-0 pb-3 text-center text-xs text-manu-cacau-suave">
            Toque para esconder ou mostrar. Nada é apagado.
          </p>
          <div
            key={negada || "lista"}
            className={`grid min-h-0 flex-1 auto-rows-min grid-cols-4 gap-2 overflow-y-auto sm:grid-cols-5 ${
              negada ? "anima-nao" : ""
            }`}
          >
            {jogos.map((jogo) => {
              const visivel = !escondidos.includes(jogo.id);
              return (
                <button
                  key={jogo.id}
                  type="button"
                  aria-label={`${jogo.nome} — ${visivel ? "aparece" : "escondido"}`}
                  data-alterna={jogo.id}
                  data-visivel={visivel ? "true" : "false"}
                  onClick={() => alternar(jogo.id)}
                  className={`flex min-h-20 flex-col items-center justify-center gap-1 rounded-2xl p-1.5 text-center transition-all ${jogo.cor} ${
                    visivel
                      ? "ring-2 ring-manu-grama"
                      : "opacity-40 grayscale ring-2 ring-manu-cacau/20"
                  }`}
                >
                  <span aria-hidden className="text-2xl">
                    {visivel ? jogo.emoji : "🙈"}
                  </span>
                  <span className="line-clamp-2 font-titulo text-[11px] leading-tight text-manu-cacau">
                    {jogo.nome}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="mx-auto mt-3 flex shrink-0 items-center gap-3">
            <button
              type="button"
              aria-label="trocar quem está jogando"
              data-trocar-jogador="true"
              onClick={() => {
                feedback("toque");
                setConfigurando(false);
                limparJogador();
              }}
              className="bolha min-h-14 bg-manu-papel px-5 font-titulo text-lg ring-2 ring-manu-cacau/10"
            >
              Trocar jogador
            </button>
            <button
              type="button"
              autoFocus
              aria-label="pronto, fechar as configurações"
              onClick={() => {
                feedback("abrir");
                setConfigurando(false);
              }}
              className="bolha min-h-14 bg-manu-sol px-8 font-titulo text-xl ring-2 ring-manu-sol-forte"
            >
              Pronto
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
