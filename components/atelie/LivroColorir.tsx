"use client";

import { COR_CONTORNO } from "@/lib/colorir/tipos";
import type { Forma, Pagina } from "@/lib/colorir/tipos";

function FormaSvg({ f }: { f: Forma }) {
  switch (f.t) {
    case "circulo":
      return <circle cx={f.cx} cy={f.cy} r={f.r} />;
    case "elipse":
      return (
        <ellipse
          cx={f.cx}
          cy={f.cy}
          rx={f.rx}
          ry={f.ry}
          transform={f.giro ? `rotate(${f.giro} ${f.cx} ${f.cy})` : undefined}
        />
      );
    case "retangulo":
      return <rect x={f.x} y={f.y} width={f.l} height={f.a} rx={f.raio} />;
    case "caminho":
      return <path d={f.d} />;
  }
}

type Props = {
  pagina: Pagina;
  cores: Record<string, string>;
  /** Só recebe toque quando o balde está na mão; com pincel, o toque é do canvas. */
  clicavel?: boolean;
  aoTocarRegiao?: (regiao: string) => void;
};

/**
 * O desenho do livro fica ACIMA das camadas de pintura, como numa folha
 * impressa: o contorno preto nunca é coberto pelo traço da criança.
 *
 * Região sem cor fica transparente (não branca) de propósito — assim o que ela
 * desenhou com o pincel por baixo continua aparecendo.
 */
export function LivroColorir({ pagina, cores, clicavel = false, aoTocarRegiao }: Props) {
  return (
    <svg
      viewBox={`0 0 ${pagina.lado} ${pagina.lado}`}
      className="aspect-square max-h-full max-w-full"
      style={{ height: "100%", width: "100%" }}
      aria-label={`desenho para colorir: ${pagina.nome}`}
    >
      <g
        stroke={COR_CONTORNO}
        strokeWidth={3.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        fill="transparent"
      >
        {pagina.regioes.map((r) => (
          <g
            key={r.id}
            fill={cores[r.id] ?? "transparent"}
            // pointer-events all: região sem cor também precisa receber o toque
            style={{ pointerEvents: clicavel ? "all" : "none" }}
            onPointerDown={
              clicavel
                ? (e) => {
                    // Sem isto o toque sobe até o canvas e o balde inunda o
                    // papel inteiro junto com a região — a tela toda vira uma cor.
                    e.stopPropagation();
                    aoTocarRegiao?.(r.id);
                  }
                : undefined
            }
            aria-label={`pintar ${r.nome}`}
          >
            {r.formas.map((f, i) => (
              <FormaSvg key={`${r.id}-${i}`} f={f} />
            ))}
          </g>
        ))}

        {(pagina.detalhes ?? []).map((d, i) => (
          <g
            key={`detalhe-${i}`}
            fill={d.preenchimento ?? "none"}
            strokeWidth={d.espessura ?? 3}
            style={{ pointerEvents: "none" }}
          >
            {d.formas.map((f, j) => (
              <FormaSvg key={`detalhe-${i}-${j}`} f={f} />
            ))}
          </g>
        ))}
      </g>
    </svg>
  );
}

/** Miniatura sem cor, usada no seletor de desenhos. */
export function MiniaturaColorir({ pagina }: { pagina: Pagina }) {
  return (
    <svg viewBox={`0 0 ${pagina.lado} ${pagina.lado}`} className="h-full w-full" aria-hidden>
      <g
        stroke={COR_CONTORNO}
        strokeWidth={4}
        strokeLinejoin="round"
        strokeLinecap="round"
        fill="#FFFFFF"
      >
        {pagina.regioes.map((r) => (
          <g key={r.id}>
            {r.formas.map((f, i) => (
              <FormaSvg key={`${r.id}-${i}`} f={f} />
            ))}
          </g>
        ))}
        {(pagina.detalhes ?? []).map((d, i) => (
          <g key={`d-${i}`} fill={d.preenchimento ?? "none"} strokeWidth={d.espessura ?? 3}>
            {d.formas.map((f, j) => (
              <FormaSvg key={`d-${i}-${j}`} f={f} />
            ))}
          </g>
        ))}
      </g>
    </svg>
  );
}
