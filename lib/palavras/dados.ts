export type Palavra = {
  palavra: string;
  emoji: string;
  /** 1 = curtas sem acento · 2 = maiores, dígrafos e acentos. */
  nivel: 1 | 2;
  /** Segmentação escrita À MÃO (SPEC §4.4) — algoritmo erra dígrafo/encontro. */
  silabas: string[];
};

/**
 * Banco de palavras PT-BR (>= 60), vocabulário concreto de 6-10 anos.
 * Invariante testada: palavra === silabas.join("").
 */
export const PALAVRAS: Palavra[] = [
  // ---- nível 1: curtas, sem acento ----
  { palavra: "GATO", emoji: "🐈", nivel: 1, silabas: ["GA", "TO"] },
  { palavra: "BOLA", emoji: "⚽", nivel: 1, silabas: ["BO", "LA"] },
  { palavra: "PATO", emoji: "🦆", nivel: 1, silabas: ["PA", "TO"] },
  { palavra: "CASA", emoji: "🏠", nivel: 1, silabas: ["CA", "SA"] },
  { palavra: "SAPO", emoji: "🐸", nivel: 1, silabas: ["SA", "PO"] },
  { palavra: "LUA", emoji: "🌙", nivel: 1, silabas: ["LU", "A"] },
  { palavra: "PIPA", emoji: "🪁", nivel: 1, silabas: ["PI", "PA"] },
  { palavra: "MALA", emoji: "🧳", nivel: 1, silabas: ["MA", "LA"] },
  { palavra: "FADA", emoji: "🧚", nivel: 1, silabas: ["FA", "DA"] },
  { palavra: "VACA", emoji: "🐄", nivel: 1, silabas: ["VA", "CA"] },
  { palavra: "DADO", emoji: "🎲", nivel: 1, silabas: ["DA", "DO"] },
  { palavra: "MOTO", emoji: "🏍️", nivel: 1, silabas: ["MO", "TO"] },
  { palavra: "RATO", emoji: "🐀", nivel: 1, silabas: ["RA", "TO"] },
  { palavra: "URSO", emoji: "🐻", nivel: 1, silabas: ["UR", "SO"] },
  { palavra: "PEIXE", emoji: "🐟", nivel: 1, silabas: ["PEI", "XE"] },
  { palavra: "UVA", emoji: "🍇", nivel: 1, silabas: ["U", "VA"] },
  { palavra: "PERA", emoji: "🍐", nivel: 1, silabas: ["PE", "RA"] },
  { palavra: "BANANA", emoji: "🍌", nivel: 1, silabas: ["BA", "NA", "NA"] },
  { palavra: "SAPATO", emoji: "👟", nivel: 1, silabas: ["SA", "PA", "TO"] },
  { palavra: "JANELA", emoji: "🪟", nivel: 1, silabas: ["JA", "NE", "LA"] },
  { palavra: "BONECA", emoji: "🪆", nivel: 1, silabas: ["BO", "NE", "CA"] },
  { palavra: "CAVALO", emoji: "🐴", nivel: 1, silabas: ["CA", "VA", "LO"] },
  { palavra: "MACACO", emoji: "🐒", nivel: 1, silabas: ["MA", "CA", "CO"] },
  { palavra: "TOMATE", emoji: "🍅", nivel: 1, silabas: ["TO", "MA", "TE"] },
  { palavra: "ABACAXI", emoji: "🍍", nivel: 1, silabas: ["A", "BA", "CA", "XI"] },

  // ---- nível 2: maiores, dígrafos e acentos ----
  { palavra: "CHUVA", emoji: "🌧️", nivel: 2, silabas: ["CHU", "VA"] },
  { palavra: "CHAVE", emoji: "🔑", nivel: 2, silabas: ["CHA", "VE"] },
  { palavra: "GALINHA", emoji: "🐔", nivel: 2, silabas: ["GA", "LI", "NHA"] },
  { palavra: "COELHO", emoji: "🐰", nivel: 2, silabas: ["CO", "E", "LHO"] },
  { palavra: "ABELHA", emoji: "🐝", nivel: 2, silabas: ["A", "BE", "LHA"] },
  { palavra: "AVIÃO", emoji: "✈️", nivel: 2, silabas: ["A", "VI", "ÃO"] },
  { palavra: "BALÃO", emoji: "🎈", nivel: 2, silabas: ["BA", "LÃO"] },
  { palavra: "LEÃO", emoji: "🦁", nivel: 2, silabas: ["LE", "ÃO"] },
  { palavra: "PÁSSARO", emoji: "🐦", nivel: 2, silabas: ["PÁS", "SA", "RO"] },
  { palavra: "ÁRVORE", emoji: "🌳", nivel: 2, silabas: ["ÁR", "VO", "RE"] },
  { palavra: "RELÓGIO", emoji: "⌚", nivel: 2, silabas: ["RE", "LÓ", "GIO"] },
  { palavra: "SORVETE", emoji: "🍦", nivel: 2, silabas: ["SOR", "VE", "TE"] },
  { palavra: "PRESENTE", emoji: "🎁", nivel: 2, silabas: ["PRE", "SEN", "TE"] },
  { palavra: "ESTRELA", emoji: "⭐", nivel: 2, silabas: ["ES", "TRE", "LA"] },
  { palavra: "FLORESTA", emoji: "🌲", nivel: 2, silabas: ["FLO", "RES", "TA"] },
  { palavra: "PRINCESA", emoji: "👸", nivel: 2, silabas: ["PRIN", "CE", "SA"] },
  { palavra: "DRAGÃO", emoji: "🐉", nivel: 2, silabas: ["DRA", "GÃO"] },
  { palavra: "BICICLETA", emoji: "🚲", nivel: 2, silabas: ["BI", "CI", "CLE", "TA"] },
  { palavra: "BORBOLETA", emoji: "🦋", nivel: 2, silabas: ["BOR", "BO", "LE", "TA"] },
  { palavra: "ELEFANTE", emoji: "🐘", nivel: 2, silabas: ["E", "LE", "FAN", "TE"] },
  { palavra: "GIRAFA", emoji: "🦒", nivel: 2, silabas: ["GI", "RA", "FA"] },
  { palavra: "FOGUETE", emoji: "🚀", nivel: 2, silabas: ["FO", "GUE", "TE"] },
  { palavra: "MONTANHA", emoji: "⛰️", nivel: 2, silabas: ["MON", "TA", "NHA"] },
  { palavra: "PIRULITO", emoji: "🍭", nivel: 2, silabas: ["PI", "RU", "LI", "TO"] },
  { palavra: "TARTARUGA", emoji: "🐢", nivel: 2, silabas: ["TAR", "TA", "RU", "GA"] },
  { palavra: "DINOSSAURO", emoji: "🦕", nivel: 2, silabas: ["DI", "NOS", "SAU", "RO"] },
  { palavra: "MELANCIA", emoji: "🍉", nivel: 2, silabas: ["ME", "LAN", "CI", "A"] },
  { palavra: "MORANGO", emoji: "🍓", nivel: 2, silabas: ["MO", "RAN", "GO"] },
  { palavra: "CENOURA", emoji: "🥕", nivel: 2, silabas: ["CE", "NOU", "RA"] },
  { palavra: "PALHAÇO", emoji: "🤡", nivel: 2, silabas: ["PA", "LHA", "ÇO"] },
  { palavra: "CACHORRO", emoji: "🐶", nivel: 2, silabas: ["CA", "CHOR", "RO"] },
  { palavra: "CORAÇÃO", emoji: "❤️", nivel: 2, silabas: ["CO", "RA", "ÇÃO"] },
  { palavra: "FORMIGA", emoji: "🐜", nivel: 2, silabas: ["FOR", "MI", "GA"] },
  { palavra: "JACARÉ", emoji: "🐊", nivel: 2, silabas: ["JA", "CA", "RÉ"] },
  { palavra: "PIPOCA", emoji: "🍿", nivel: 2, silabas: ["PI", "PO", "CA"] },
  { palavra: "QUEIJO", emoji: "🧀", nivel: 2, silabas: ["QUEI", "JO"] },
];
