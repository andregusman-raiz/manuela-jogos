/**
 * Paleta do Ateliê.
 *
 * As cores vêm em bolinhas grandes, nunca em roda de matiz nem campo hex: aos 6
 * anos a criança escolhe reconhecendo a cor, não ajustando parâmetros. Os nomes
 * existem para o leitor de tela e para o adulto.
 */

export type Cor = { hex: string; nome: string };

/** 24 cores fortes — as que aparecem direto na fita, sem abrir nada. */
export const CORES_PRINCIPAIS: Cor[] = [
  { hex: "#1A1A1A", nome: "preto" },
  { hex: "#8C8C8C", nome: "cinza" },
  { hex: "#FFFFFF", nome: "branco" },
  { hex: "#E5352B", nome: "vermelho" },
  { hex: "#F76B15", nome: "laranja" },
  { hex: "#FFC61A", nome: "amarelo" },
  { hex: "#F8DE7B", nome: "amarelo claro" },
  { hex: "#8FD14F", nome: "verde limão" },
  { hex: "#2FA84F", nome: "verde" },
  { hex: "#0E6B45", nome: "verde escuro" },
  { hex: "#5BB5A2", nome: "verde água" },
  { hex: "#AEDEDE", nome: "azul bebê" },
  { hex: "#2E9BE6", nome: "azul" },
  { hex: "#1B4FA8", nome: "azul escuro" },
  { hex: "#7A4FCF", nome: "roxo" },
  { hex: "#C455D6", nome: "lilás" },
  { hex: "#F09BC0", nome: "rosa" },
  { hex: "#E8558E", nome: "rosa forte" },
  { hex: "#F6C6A8", nome: "pele clara" },
  { hex: "#EAA266", nome: "pele" },
  { hex: "#A9603A", nome: "pele escura" },
  { hex: "#6B4630", nome: "marrom" },
  { hex: "#2E1408", nome: "marrom escuro" },
  { hex: "#D9A93B", nome: "dourado" },
];

/** Mais 24 tons, atrás do botão do arco-íris (descoberta dos maiores). */
export const CORES_EXTRAS: Cor[] = [
  { hex: "#FFD9E4", nome: "rosa claro" },
  { hex: "#FF8FAB", nome: "rosa chiclete" },
  { hex: "#C41E5A", nome: "framboesa" },
  { hex: "#7A1030", nome: "vinho" },
  { hex: "#FFE9B8", nome: "creme" },
  { hex: "#FFB03A", nome: "manga" },
  { hex: "#C97A16", nome: "caramelo" },
  { hex: "#6E4B12", nome: "castanho" },
  { hex: "#E8F5A0", nome: "verde bebê" },
  { hex: "#B6E36A", nome: "abacate" },
  { hex: "#3C7A2A", nome: "folha" },
  { hex: "#12402A", nome: "floresta" },
  { hex: "#CFF3F1", nome: "gelo" },
  { hex: "#6ED0D8", nome: "turquesa" },
  { hex: "#1E7E9C", nome: "oceano" },
  { hex: "#0B2C4D", nome: "azul noite" },
  { hex: "#E4D7FF", nome: "lavanda" },
  { hex: "#9B7BE8", nome: "uva" },
  { hex: "#5B2C99", nome: "ameixa" },
  { hex: "#2B1A4D", nome: "roxo noite" },
  { hex: "#F2F2F2", nome: "branco neve" },
  { hex: "#C9C9C9", nome: "cinza claro" },
  { hex: "#5A5A5A", nome: "cinza escuro" },
  { hex: "#000000", nome: "preto total" },
];

/** 4 espessuras visuais — bolinhas crescentes, nunca número nem slider. */
export const ESPESSURAS = [6, 14, 28, 52] as const;

/** Fundos do desenho livre. */
export const FUNDOS: Cor[] = [
  { hex: "#FFFFFF", nome: "branco" },
  { hex: "#FFF9F3", nome: "creme" },
  { hex: "#DCF2F2", nome: "céu" },
  { hex: "#FFE3EE", nome: "rosa bebê" },
  { hex: "#E9F7D9", nome: "grama" },
  { hex: "#1B2340", nome: "noite" },
];
