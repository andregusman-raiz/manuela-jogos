/**
 * Ícones de sistema do Manuela Jogos, desenhados à mão.
 *
 * Por que não emoji: emoji renderiza diferente em cada aparelho (o alto-falante
 * do Android não é o do iPhone nem o do desktop), e os ícones ESTRUTURAIS são a
 * identidade do app. Todos compartilham o mesmo traço grosso arredondado e as
 * cores da paleta Manu — em qualquer tela, o app é o mesmo.
 *
 * Emoji continua onde variedade importa mais que consistência: carimbos, formas
 * e os tipos de pincel.
 */

const CACAU = "#2E1408";
const ROSA = "#F09BC0";
const CEU = "#AEDEDE";
const SOL = "#F8DE7B";
const SOL_FORTE = "#EDC23F";
const PAPEL = "#FFFFFF";

export type NomeIcone =
  | "livro"
  | "som"
  | "mudo"
  | "estrela"
  | "borracha"
  | "balde"
  | "varinha"
  | "desfazer"
  | "refazer"
  | "lixeira"
  | "enviar"
  | "voltar"
  | "galeria"
  | "alvo";

const DESENHOS: Record<NomeIcone, React.ReactNode> = {
  voltar: (
    <path
      d="M14.5 5.5 L8 12 L14.5 18.5"
      fill="none"
      stroke={CACAU}
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  estrela: (
    <path
      d="M12 2.8 L14.7 8.4 L20.9 9.2 L16.4 13.5 L17.5 19.6 L12 16.7 L6.5 19.6 L7.6 13.5 L3.1 9.2 L9.3 8.4 Z"
      fill={PAPEL}
      stroke={CACAU}
      strokeWidth={1.8}
      strokeLinejoin="round"
    />
  ),
  som: (
    <g stroke={CACAU} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 9.2 V14.8 H7.4 L12.4 19 V5 L7.4 9.2 Z" fill={CEU} />
      <path d="M15.6 9.4 a3.8 3.8 0 0 1 0 5.2" fill="none" />
      <path d="M18.2 7.4 a7 7 0 0 1 0 9.2" fill="none" />
    </g>
  ),
  mudo: (
    <g stroke={CACAU} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 9.2 V14.8 H7.4 L12.4 19 V5 L7.4 9.2 Z" fill={CEU} opacity={0.55} />
      <path d="M15.6 9.6 L20.4 14.4 M20.4 9.6 L15.6 14.4" fill="none" strokeWidth={2.4} />
    </g>
  ),
  livro: (
    <g stroke={CACAU} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path
        d="M12 6.2 C10 4.7 7 4.3 3.6 4.9 V18.3 C7 17.7 10 18.1 12 19.6 C14 18.1 17 17.7 20.4 18.3 V4.9 C17 4.3 14 4.7 12 6.2 Z"
        fill={ROSA}
      />
      <path d="M12 6.2 V19.6" fill="none" />
      <path d="M6.4 8.9 C7.8 8.8 9 9 10 9.5 M6.4 12 C7.8 11.9 9 12.1 10 12.6" fill="none" strokeWidth={1.4} stroke={PAPEL} />
    </g>
  ),
  borracha: (
    <g stroke={CACAU} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path
        d="M4.8 13.9 L12.9 5.8 a2.4 2.4 0 0 1 3.4 0 l2.5 2.5 a2.4 2.4 0 0 1 0 3.4 L10.7 19.8 H6.9 L4.8 17.3 a2.4 2.4 0 0 1 0 -3.4 Z"
        fill={ROSA}
      />
      <path d="M9.2 9.5 l5.9 5.9" fill="none" />
      <path d="M10.7 19.8 H19.6" fill="none" />
    </g>
  ),
  balde: (
    <g stroke={CACAU} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5.4 8.6 H16.6 L15.4 18.4 a2 2 0 0 1 -2 1.8 H8.6 a2 2 0 0 1 -2 -1.8 Z" fill={CEU} />
      <ellipse cx="11" cy="8.6" rx="5.6" ry="2" fill={PAPEL} />
      <path d="M19.7 12.2 c1.5 2 1.5 3.6 0 4.7 c-1.5 -1.1 -1.5 -2.7 0 -4.7 Z" fill={CEU} />
    </g>
  ),
  varinha: (
    <g stroke={CACAU} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.6 19.4 L13.4 10.6" strokeWidth={2.6} stroke={SOL_FORTE} />
      <path d="M16.8 3.6 L17.8 6.2 L20.4 7.2 L17.8 8.2 L16.8 10.8 L15.8 8.2 L13.2 7.2 L15.8 6.2 Z" fill={SOL} />
      <circle cx="19.5" cy="12.5" r="1.1" fill={ROSA} stroke="none" />
      <circle cx="11.5" cy="4.5" r="1.1" fill={CEU} stroke="none" />
    </g>
  ),
  desfazer: (
    <g stroke={CACAU} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" fill="none">
      <path d="M8.4 5.6 L4.6 9.4 L8.4 13.2" />
      <path d="M4.9 9.4 H14 a5.4 5.4 0 0 1 5.4 5.4 v0.4 a3.6 3.6 0 0 1 -3.6 3.6 H10" />
    </g>
  ),
  refazer: (
    <g stroke={CACAU} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" fill="none">
      <path d="M15.6 5.6 L19.4 9.4 L15.6 13.2" />
      <path d="M19.1 9.4 H10 a5.4 5.4 0 0 0 -5.4 5.4 v0.4 a3.6 3.6 0 0 0 3.6 3.6 H14" />
    </g>
  ),
  lixeira: (
    <g stroke={CACAU} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.8 7.2 H19.2" fill="none" />
      <path d="M9.4 7.2 V5.6 a1.3 1.3 0 0 1 1.3 -1.3 h2.6 a1.3 1.3 0 0 1 1.3 1.3 V7.2" fill="none" />
      <path d="M6.6 7.2 l0.9 11.2 a2 2 0 0 0 2 1.8 h5 a2 2 0 0 0 2 -1.8 L17.4 7.2 Z" fill={CEU} />
      <path d="M10.2 10.6 v6 M13.8 10.6 v6" fill="none" />
    </g>
  ),
  enviar: (
    <g stroke={CACAU} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.6 3.8 L3.6 10.6 l5.6 2.3 2.3 5.6 Z" fill={CEU} />
      <path d="M20.6 3.8 L9.2 12.9" fill="none" />
    </g>
  ),
  galeria: (
    <g stroke={CACAU} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3.6" y="4.8" width="16.8" height="14.4" rx="2.4" fill={PAPEL} />
      <circle cx="9" cy="9.6" r="1.7" fill={SOL} stroke="none" />
      <path d="M5.6 16.6 l3.7 -3.7 2.6 2.6 3.1 -3.1 3.4 3.4" fill="none" stroke={ROSA} strokeWidth={2.2} />
    </g>
  ),
  alvo: (
    <g stroke={CACAU} strokeWidth={2} strokeLinecap="round">
      <circle cx="12" cy="12" r="6.2" fill={PAPEL} />
      <circle cx="12" cy="12" r="2.2" fill={ROSA} stroke="none" />
      <path d="M12 2.6 v2.6 M12 18.8 v2.6 M2.6 12 h2.6 M18.8 12 h2.6" fill="none" />
    </g>
  ),
};

type Props = {
  nome: NomeIcone;
  /** Lado em px. Os botões-bolha usam 30-34. */
  tamanho?: number;
  className?: string;
};

export function Icone({ nome, tamanho = 32, className = "" }: Props) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={tamanho}
      height={tamanho}
      aria-hidden
      className={`shrink-0 ${className}`}
    >
      {DESENHOS[nome]}
    </svg>
  );
}
