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
    id: "contas",
    nome: "Foguete das Contas",
    descricao: "Contas de somar e tabuada",
    rota: "/contas",
    emoji: "🚀",
    cor: "bg-manu-ceu",
    disponivel: true,
  },
  {
    id: "memoria",
    nome: "Jogo da Memória",
    descricao: "Encontre os pares",
    rota: "/memoria",
    emoji: "🃏",
    cor: "bg-manu-sol",
    disponivel: true,
  },
  {
    id: "labirinto",
    nome: "Labirinto da Manu",
    descricao: "Guie a Manu até a estrela",
    rota: "/labirinto",
    emoji: "⭐",
    cor: "bg-manu-grama",
    disponivel: true,
  },
  {
    id: "palavras",
    nome: "Palavra Mágica",
    descricao: "Complete as palavras",
    rota: "/palavras",
    emoji: "🔤",
    cor: "bg-manu-ceu/50",
    disponivel: true,
  },
  {
    id: "forca",
    nome: "Forca da Manu",
    descricao: "Adivinhe a palavra",
    rota: "/forca",
    emoji: "🎈",
    cor: "bg-manu-ceu-claro",
    disponivel: true,
  },
  {
    id: "relogio",
    nome: "Relógio Mágico",
    descricao: "Que horas são?",
    rota: "/relogio",
    emoji: "⏰",
    cor: "bg-manu-sol/70",
    disponivel: true,
  },
  {
    id: "lojinha",
    nome: "Lojinha da Manu",
    descricao: "Pague e receba o troco",
    rota: "/lojinha",
    emoji: "🛒",
    cor: "bg-manu-pele",
    disponivel: true,
  },
  {
    id: "genius",
    nome: "Genius dos Sons",
    descricao: "Escute e repita",
    rota: "/genius",
    emoji: "🎵",
    cor: "bg-manu-ceu",
    disponivel: true,
  },
  {
    id: "fracoes",
    nome: "Pizza das Frações",
    descricao: "Leia, pinte e compare",
    rota: "/fracoes",
    emoji: "🍕",
    cor: "bg-manu-rosa/60",
    disponivel: true,
  },
  {
    id: "estados",
    nome: "Estados do Brasil",
    descricao: "Ache no mapa",
    rota: "/estados",
    emoji: "🗺️",
    cor: "bg-manu-grama/70",
    disponivel: true,
  },
  {
    id: "tangram",
    nome: "Tangram da Manu",
    descricao: "Monte as figuras",
    rota: "/tangram",
    emoji: "🔷",
    cor: "bg-manu-ceu-claro",
    disponivel: true,
  },
  {
    id: "damas",
    nome: "Damas",
    descricao: "Jogue com alguém",
    rota: "/damas",
    emoji: "⚪",
    cor: "bg-manu-cacau/15",
    disponivel: true,
  },
  {
    id: "caca",
    nome: "Caça-Números",
    descricao: "Pares, múltiplos e fatores",
    rota: "/caca",
    emoji: "🔢",
    cor: "bg-manu-sol",
    disponivel: true,
  },
  {
    id: "ludo",
    nome: "Ludo da Manu",
    descricao: "Corrida de dados",
    rota: "/ludo",
    emoji: "🎲",
    cor: "bg-manu-rosa/60",
    disponivel: true,
  },
  {
    id: "cobras",
    nome: "Cobras e Escadas",
    descricao: "Corrida ate o 100",
    rota: "/cobras",
    emoji: "🐍",
    cor: "bg-manu-grama/70",
    disponivel: true,
  },
  {
    id: "lig4",
    nome: "Lig-4",
    descricao: "4 em linha, com a Manu",
    rota: "/lig4",
    emoji: "🔵",
    cor: "bg-manu-ceu",
    disponivel: true,
  },
  {
    id: "mancala",
    nome: "Mancala",
    descricao: "Semeie e colha",
    rota: "/mancala",
    emoji: "🫘",
    cor: "bg-manu-sol/60",
    disponivel: true,
  },
  {
    id: "rota",
    nome: "Roda Romana",
    descricao: "Tres em linha na roda",
    rota: "/rota",
    emoji: "⭕",
    cor: "bg-manu-rosa/30",
    disponivel: true,
  },
];
