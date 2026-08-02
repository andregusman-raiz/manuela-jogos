"use client";

import Image from "next/image";
import { usePerfil } from "@/lib/usePerfil";

/**
 * A mascote na interface — a figura do PERFIL ESCOLHIDO (Manuela, Leo…).
 *
 * Ela não é decoração: cumpre um papel em cada lugar onde aparece — recebe no
 * hub, guia quando a galeria está vazia, comemora quando salva e pede um adulto
 * no portão parental.
 *
 * Poses `corpo` e `rosto` são os dois assets do perfil; as outras são
 * variações de enquadramento/movimento sobre eles. Trocar de jogador troca a
 * figura em TODOS os usos, sem mexer em quem usa o componente.
 */
export type PoseMascote =
  | "corpo" // hero do hub, corpo inteiro
  | "rosto" // avatar do cabeçalho
  | "comemorando" // salvou o desenho
  | "apontando" // guia (galeria vazia)
  | "segredinho"; // portão parental ("chame um adulto")

type Props = {
  pose?: PoseMascote;
  /** Largura em px do lado maior; a altura acompanha a proporção. */
  tamanho?: number;
  className?: string;
  prioridade?: boolean;
};

const POSES: Record<PoseMascote, { asset: "corpo" | "avatar"; classe: string }> = {
  corpo: { asset: "corpo", classe: "" },
  rosto: { asset: "avatar", classe: "rounded-full" },
  comemorando: { asset: "corpo", classe: "anima-pulinho" },
  apontando: { asset: "corpo", classe: "-scale-x-100" },
  segredinho: { asset: "corpo", classe: "" },
};

export function Mascote({
  pose = "corpo",
  tamanho = 200,
  className = "",
  prioridade = false,
}: Props) {
  const perfil = usePerfil();
  const { asset, classe } = POSES[pose];
  const { src, largura, altura } = perfil[asset];
  const escala = tamanho / Math.max(largura, altura);

  return (
    <Image
      src={src}
      alt={perfil.identidade.altMascote}
      width={Math.round(largura * escala)}
      height={Math.round(altura * escala)}
      priority={prioridade}
      draggable={false}
      className={`select-none ${classe} ${className}`}
    />
  );
}
