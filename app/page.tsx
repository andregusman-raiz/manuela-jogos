import { GradeJogos } from "@/components/hub/GradeJogos";
import { Mascote } from "@/components/ui-kids/Mascote";
import { IDENTIDADE, saudacao } from "@/lib/identidade";
import { CHAVE_JOGADOR } from "@/lib/perfis";

// Anti-FOUC do gate de jogador (review PR #47): sem isto, o HTML SSR do hub
// fica clicável ANTES de a hidratação montar a tela "Quem vai jogar?" numa
// primeira visita. O script roda inline antes do primeiro paint; o atributo
// esconde o hub via CSS e a GradeJogos o remove assim que assume o controle.
const SCRIPT_GATE = `try{if(!localStorage.getItem(${JSON.stringify(CHAVE_JOGADOR)}))document.documentElement.setAttribute("data-sem-jogador","")}catch(e){}`;

export default function Hub() {
  return (
    <main
      data-hub="true"
      className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]"
    >
      <script dangerouslySetInnerHTML={{ __html: SCRIPT_GATE }} />
      <header className="relative flex items-end justify-between gap-2">
        <div className="pb-2">
          <p className="font-titulo text-lg text-manu-rosa-texto">{saudacao()}</p>
          <h1 className="font-titulo text-4xl leading-none text-manu-cacau">
            {IDENTIDADE.nome}
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
          <Mascote
            pose="corpo"
            tamanho={190}
            prioridade
            className="anima-pulinho h-auto max-h-[20dvh] w-full object-contain drop-shadow-md"
          />
        </div>
      </header>

      {/* grade + rodapé + engrenagem viraram client component: o filtro de
          jogos visíveis (localStorage) e o modal de configuração vivem lá;
          hub.spec continua sendo o gate da dobra */}
      <GradeJogos />
    </main>
  );
}
