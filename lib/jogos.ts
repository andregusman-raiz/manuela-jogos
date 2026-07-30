/**
 * Manifesto de jogos do hub.
 *
 * O hub renderiza a partir desta lista: cada jogo novo é uma rota + uma entrada
 * aqui, sem tocar no layout do hub. É o contrato que torna "o primeiro de vários"
 * barato de expandir.
 */

export type Jogo = {
  id: string;
  nome: string;
  /** Frase curta para o adulto; a criança se orienta pelo ícone e pela cor. */
  descricao: string;
  rota: string;
  /** Emoji grande do card — literal, nunca abstrato. */
  emoji: string;
  /** Classe Tailwind de fundo do card. */
  cor: string;
  disponivel: boolean;
};

export const JOGOS: Jogo[] = [
  {
    id: "atelie",
    nome: "Ateliê da Manu",
    descricao: "Desenhar, pintar e colorir",
    rota: "/desenhar",
    emoji: "🎨",
    cor: "bg-manu-rosa",
    disponivel: true,
  },
  {
    id: "em-breve",
    nome: "Em breve",
    descricao: "Mais um jogo está chegando",
    rota: "/",
    emoji: "🎁",
    cor: "bg-manu-ceu",
    disponivel: false,
  },
];
