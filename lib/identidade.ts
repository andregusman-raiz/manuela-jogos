/**
 * Identidade da criança/mascote — a ÚNICA fonte de nome, apelido, gênero e
 * figura em todo o app (SPEC-identidade-mascote v1.1).
 *
 * Fase 1: constantes com a Manuela. Fase 2 (futura): um override em runtime
 * troca a tripla {nome, apelido, genero} e a figura SEM tocar em nenhum jogo —
 * por isso a fábrica é pura, este módulo não importa NADA do app, e o gate
 * anti-regressão (tests/unidade/identidade-gate.test.ts) impede que qualquer
 * texto com o nome volte a ser hard-coded fora daqui.
 */

export interface DadosIdentidade {
  nome: string;
  apelido: string;
  /** Flexão de TODA a UI: artigos, saudação, conquistas. */
  genero: "a" | "o";
}

export interface Identidade extends DadosIdentidade {
  tituloApp: string;
  tituloCurto: string;
  descricaoApp: string;
  altMascote: string;
  /** Apelido normalizado para nomes de arquivo: "manu", "maria-clara". */
  slug: string;
}

const TAMANHO_MAXIMO = 20;

function slugDe(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Pura e validada: TODOS os campos derivados nascem aqui, nunca soltos. */
export function criarIdentidade(dados: DadosIdentidade): Identidade {
  const nome = dados.nome.trim();
  const apelido = dados.apelido.trim();
  if (!nome || !apelido) throw new Error("identidade precisa de nome e apelido");
  if (nome.length > TAMANHO_MAXIMO || apelido.length > TAMANHO_MAXIMO) {
    throw new Error(`nome/apelido passam de ${TAMANHO_MAXIMO} caracteres`);
  }
  // Unicode de verdade (review PR #52): "София" tem letras — a régua é
  // \p{L}/\p{N}, não o slug ascii (que pode ficar vazio para não-latinos)
  const temLetra = (t: string) => /[\p{L}\p{N}]/u.test(t);
  if (!temLetra(apelido)) {
    throw new Error("apelido precisa de ao menos uma letra ou número");
  }
  if (!temLetra(nome)) {
    throw new Error("nome precisa de ao menos uma letra ou número");
  }
  const artigo = dados.genero;
  return {
    nome,
    apelido,
    genero: dados.genero,
    tituloApp: `${nome} Jogos`,
    tituloCurto: `${apelido} Jogos`,
    descricaoApp: `Jogos para brincar, desenhar e pintar. Feito para ${artigo} ${nome}.`,
    altMascote: nome,
    slug: slugDe(apelido) || "jogador",
  };
}

export const IDENTIDADE = criarIdentidade({ nome: "Manuela", apelido: "Manu", genero: "a" });

/** Figura da mascote: a fase 2 troca a FONTE aqui, sem tocar nos usos. */
export const MASCOTE = {
  corpo: { src: "/manu/manu-corpo.webp", largura: 642, altura: 1244 },
  avatar: { src: "/manu/manu-avatar.webp", largura: 512, altura: 512 },
  alt: IDENTIDADE.altMascote,
} as const;

// ─── Helpers de flexão (única gramática de gênero do app) ─────────────────
// O parâmetro opcional serve à fase 2 (override) e aos testes com outras
// identidades; os call-sites do app usam a forma sem argumento.

export function flexionar(masculino: string, feminino: string, id: Identidade = IDENTIDADE): string {
  return id.genero === "a" ? feminino : masculino;
}

export function daMascote(id: Identidade = IDENTIDADE): string {
  return `${flexionar("do", "da", id)} ${id.apelido}`;
}

export function aMascote(id: Identidade = IDENTIDADE): string {
  return `${id.genero} ${id.apelido}`;
}

export function comAMascote(id: Identidade = IDENTIDADE): string {
  return `com ${aMascote(id)}`;
}

export function paraAMascote(id: Identidade = IDENTIDADE): string {
  return `para ${id.genero} ${id.nome}`;
}

export function saudacao(id: Identidade = IDENTIDADE): string {
  return `${flexionar("Bem-vindo", "Bem-vinda", id)}!`;
}
