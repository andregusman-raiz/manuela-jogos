"use client";

import { useMemo, useState } from "react";
import { Manu } from "./Manu";
import { feedback, tocar } from "@/lib/som";

type Props = {
  aberto: boolean;
  onLiberado: () => void;
  onCancelar: () => void;
};

/** Conta simples que uma criança de 6-8 anos ainda não resolve de cabeça. */
function novaConta() {
  const a = 3 + Math.floor(Math.random() * 7); // 3..9
  const b = 4 + Math.floor(Math.random() * 6); // 4..9
  return { a, b, resposta: a + b };
}

/**
 * Portão parental — aparece SÓ antes de salvar/compartilhar (única coisa que
 * sai do aparelho). Formato aprovado pela Apple e pela FTC: conta simples.
 *
 * O anti-padrão explicitamente evitado é o do caso Kurbo: perguntar "você é
 * adulto?" só ensina a criança a responder sim. Aqui a barreira é uma
 * habilidade que ela ainda não tem, e a Manuela sinaliza visualmente que é hora
 * de chamar alguém.
 */
export function PortaoParental({ aberto, onLiberado, onCancelar }: Props) {
  const [conta, setConta] = useState(novaConta);
  const [digitado, setDigitado] = useState("");
  const [errou, setErrou] = useState(false);

  const teclas = useMemo(() => ["1", "2", "3", "4", "5", "6", "7", "8", "9", "←", "0", "ok"], []);

  if (!aberto) return null;

  const digitar = (tecla: string) => {
    if (tecla === "←") {
      setDigitado((d) => d.slice(0, -1));
      return;
    }
    if (tecla === "ok") {
      if (Number(digitado) === conta.resposta) {
        tocar("salvar");
        setDigitado("");
        setErrou(false);
        onLiberado();
      } else {
        tocar("apagar");
        setErrou(true);
        setDigitado("");
        setConta(novaConta());
      }
      return;
    }
    if (digitado.length < 2) setDigitado((d) => d + tecla);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-manu-cacau/40 p-4 sm:items-center">
      <div
        role="dialog"
        aria-label="Precisa de um adulto"
        className="anima-entrada w-full max-w-sm rounded-[2rem] bg-manu-papel p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-center shadow-2xl"
      >
        <div className="mx-auto -mt-16 h-28 w-28 overflow-hidden">
          <Manu pose="segredinho" tamanho={150} className="mx-auto -mt-4" />
        </div>

        <h2 className="mt-1 text-2xl text-manu-cacau">Chame um adulto 🙋</h2>
        <p className="mt-1 text-sm text-manu-cacau-suave">
          Para guardar ou enviar o desenho, resolva a continha:
        </p>

        <p className="mt-3 font-titulo text-4xl text-manu-cacau">
          {conta.a} + {conta.b} = <span className="text-manu-rosa-forte">{digitado || "?"}</span>
        </p>
        {errou ? (
          <p className="mt-1 text-sm text-manu-rosa-forte">Não foi essa. Tente a nova conta!</p>
        ) : null}

        <div className="mt-4 grid grid-cols-3 gap-2">
          {teclas.map((t) => (
            <button
              key={t}
              type="button"
              aria-label={t === "←" ? "apagar" : t === "ok" ? "confirmar" : t}
              onPointerDown={() => feedback("toque")}
              onClick={() => digitar(t)}
              className={`bolha min-h-16 min-w-16 text-2xl ${
                t === "ok"
                  ? "bg-manu-sol text-manu-cacau"
                  : t === "←"
                    ? "bg-manu-ceu-claro"
                    : "bg-manu-nuvem ring-2 ring-manu-cacau/10"
              }`}
            >
              {t === "ok" ? "✓" : t}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => {
            feedback("desfazer");
            setDigitado("");
            setErrou(false);
            onCancelar();
          }}
          className="mt-4 min-h-14 w-full rounded-2xl text-lg text-manu-cacau-suave underline"
        >
          Voltar a desenhar
        </button>
      </div>
    </div>
  );
}
