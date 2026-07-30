import Image from "next/image";

/**
 * A Manuela na interface.
 *
 * Ela não é decoração: cumpre um papel em cada lugar onde aparece — recebe no
 * hub, guia quando a galeria está vazia, comemora quando salva e pede um adulto
 * no portão parental.
 *
 * Poses `corpo` e `rosto` são os dois assets reais (recortados da arte de
 * referência). As outras poses são variações de enquadramento/movimento sobre
 * esses assets — quando houver arte nova para cada pose, basta apontar o mapa
 * abaixo para os novos arquivos, sem mexer em quem usa o componente.
 */
export type PoseManu =
  | "corpo" // hero do hub, corpo inteiro
  | "rosto" // avatar do cabeçalho
  | "comemorando" // salvou o desenho
  | "apontando" // guia (galeria vazia)
  | "segredinho"; // portão parental ("chame um adulto")

type Props = {
  pose?: PoseManu;
  /** Largura em px do lado maior; a altura acompanha a proporção. */
  tamanho?: number;
  className?: string;
  prioridade?: boolean;
};

const ASSETS = {
  corpo: { src: "/manu/manu-corpo.webp", largura: 642, altura: 1244 },
  rosto: { src: "/manu/manu-avatar.webp", largura: 512, altura: 512 },
} as const;

const POSES: Record<PoseManu, { asset: keyof typeof ASSETS; classe: string }> = {
  corpo: { asset: "corpo", classe: "" },
  rosto: { asset: "rosto", classe: "rounded-full" },
  comemorando: { asset: "corpo", classe: "anima-pulinho" },
  apontando: { asset: "corpo", classe: "-scale-x-100" },
  segredinho: { asset: "corpo", classe: "" },
};

export function Manu({ pose = "corpo", tamanho = 200, className = "", prioridade = false }: Props) {
  const { asset, classe } = POSES[pose];
  const { src, largura, altura } = ASSETS[asset];
  const escala = tamanho / Math.max(largura, altura);

  return (
    <Image
      src={src}
      alt="Manuela"
      width={Math.round(largura * escala)}
      height={Math.round(altura * escala)}
      priority={prioridade}
      draggable={false}
      className={`select-none ${classe} ${className}`}
    />
  );
}
