import { JOGOS } from "@/lib/jogos";
import { CardJogo } from "@/components/hub/CardJogo";
import { Manu } from "@/components/ui-kids/Manu";

export default function Hub() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]">
      <header className="relative flex items-end justify-between gap-2">
        <div className="pb-2">
          <p className="font-titulo text-lg text-manu-rosa-texto">Bem-vinda!</p>
          <h1 className="font-titulo text-4xl leading-none text-manu-cacau">
            Manuela
            <br />
            Jogos
          </h1>
        </div>
        {/* largura fluida: em tela de 360px a Manuela não pode ser cortada */}
        <div className="relative w-[44%] max-w-[190px] shrink-0 deitado:hidden">
          <span
            aria-hidden
            className="anima-brilho absolute -left-2 top-2 text-3xl text-manu-sol-forte"
          >
            ✨
          </span>
          <Manu
            pose="corpo"
            tamanho={190}
            prioridade
            className="anima-pulinho h-auto max-h-[20dvh] w-full object-contain drop-shadow-md"
          />
        </div>
      </header>

      {/* 10+ jogos: 4 colunas no celular, 5 no sm — as contas estão na SPEC
          da onda 3 §2; hub.spec é o gate da dobra */}
      <div className="mt-1 grid flex-1 grid-cols-4 content-center gap-2 sm:grid-cols-5 sm:gap-4">
        {JOGOS.map((jogo) => (
          <CardJogo key={jogo.id} jogo={jogo} />
        ))}
      </div>

      <p className="mt-auto pt-2 text-center text-xs text-manu-cacau-suave">
        Sem anúncios, sem cadastro. Tudo fica só neste aparelho.
      </p>
    </main>
  );
}
