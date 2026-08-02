"use client";

import Image from "next/image";
import { apagarDaGaleria } from "@/lib/armazenamento";
import type { Desenho } from "@/lib/desenho/tipos";
import { BotaoSegurar } from "@/components/ui-kids/BotaoSegurar";
import { Mascote } from "@/components/ui-kids/Mascote";
import { feedback, tocar } from "@/lib/som";
import { Icone } from "@/components/ui-kids/Icone";

type Props = {
  aberta: boolean;
  desenhos: Desenho[];
  aoFechar: () => void;
  aoAbrir: (desenho: Desenho) => void;
  aoCompartilhar: (desenho: Desenho) => void;
  /** O Ateliê relê a lista do banco (ex.: depois de apagar um desenho). */
  aoRecarregar: () => void;
};

/**
 * "Meus desenhos".
 *
 * Miniatura grande, sem texto. Apagar exige segurar o dedo (nada de perder
 * trabalho num toque). Compartilhar passa pelo portão parental — quem cuida
 * disso é o Ateliê; aqui só dizemos qual desenho é.
 *
 * A lista chega pronta por prop: quem busca no banco é o Ateliê, no momento em
 * que a criança toca para abrir a galeria.
 */
export function Galeria({
  aberta,
  desenhos,
  aoFechar,
  aoAbrir,
  aoCompartilhar,
  aoRecarregar,
}: Props) {
  if (!aberta) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-manu-nuvem">
      <header className="flex items-center gap-2 px-3 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2">
        <button
          type="button"
          aria-label="voltar a desenhar"
          onPointerDown={() => feedback("desfazer")}
          onClick={aoFechar}
          className="bolha min-h-14 min-w-14 bg-manu-papel ring-2 ring-manu-cacau/10"
        >
          <Icone nome="voltar" tamanho={28} />
        </button>
        <h2 className="font-titulo text-2xl text-manu-cacau">Meus desenhos</h2>
      </header>

      {desenhos.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
          <Mascote pose="apontando" tamanho={180} />
          <p className="font-titulo text-xl text-manu-cacau">Ainda não tem nada aqui!</p>
          <p className="text-sm text-manu-cacau-suave">
            Desenhe e toque na estrelinha ⭐ para guardar.
          </p>
        </div>
      ) : (
        <div className="grid flex-1 grid-cols-2 content-start gap-3 overflow-y-auto px-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:grid-cols-3">
          {desenhos.map((d) => (
            <div
              key={d.id}
              className="relative overflow-hidden rounded-[1.5rem] bg-manu-papel shadow-[0_4px_0_0_rgba(0,0,0,0.1)] ring-2 ring-manu-cacau/10"
            >
              <button
                type="button"
                aria-label="abrir este desenho"
                onPointerDown={() => feedback("abrir")}
                onClick={() => aoAbrir(d)}
                className="block aspect-square w-full"
              >
                {d.miniatura ? (
                  <Image
                    src={d.miniatura}
                    alt="desenho guardado"
                    width={320}
                    height={320}
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <span className="text-4xl">🎨</span>
                )}
              </button>

              <div className="flex items-center justify-between gap-1 border-t border-manu-cacau/10 p-1">
                <button
                  type="button"
                  aria-label="enviar este desenho"
                  onPointerDown={() => feedback("toque")}
                  onClick={() => aoCompartilhar(d)}
                  className="bolha min-h-12 min-w-12 bg-manu-ceu-claro"
                >
                  <Icone nome="enviar" tamanho={24} />
                </button>
                <BotaoSegurar
                  rotulo="segure para apagar este desenho"
                  duracao={2000}
                  className="min-h-12 min-w-12 !bg-manu-nuvem"
                  onConfirmar={async () => {
                    await apagarDaGaleria(d.id);
                    tocar("apagar");
                    aoRecarregar();
                  }}
                >
                  <Icone nome="lixeira" tamanho={24} />
                </BotaoSegurar>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
