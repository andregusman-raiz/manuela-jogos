import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, test } from "vitest";

/**
 * Gate anti-regressão da identidade (SPEC-identidade-mascote §4.2): NENHUM
 * texto de UI com o nome da mascote pode voltar a ser hard-coded fora de
 * lib/identidade.ts. Varre por AST (não por regex em texto cru — 289 tokens
 * CSS `*-manu-*` e afins seriam falsos positivos).
 */

const PROIBIDO = /(?<![\p{L}\p{N}_])(manuela|manu|bem-vind[ao])(?![\p{L}\p{N}_])/iu;

/** Literais integralmente técnicos: contrato de armazenamento/asset, não UI. */
const TECNICOS = [
  /^\/manu\//, // paths de asset e ícone
  /^manu-jogos(-ocultos)?$/, // banco + chave localStorage
  /^manu-(app|assets)-/, // caches do SW
  /^manu$/, // discriminante de modo de jogo (valor interno)
  /^manu:/, // chaves localStorage do app ("manu:mudo", "manu:descobriu-mais")
  /^manu-$/, // prefixo de key React em template (`manu-${…}`)
  /^manuela$/, // id do perfil default em lib/perfis.ts (valor de storage, não UI)
];

function tecnico(texto: string): boolean {
  // integralmente técnico = TODO token com match do PROIBIDO é, ele mesmo,
  // um identificador técnico (exceção exata ou classe CSS `*-manu-*`).
  // Prefixo técnico + nome solto ("manu-app-v20 Manu") NÃO passa.
  const tokens = texto.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return false;
  return tokens.every(
    (t) => !PROIBIDO.test(t) || TECNICOS.some((re) => re.test(t)) || t.includes("-manu-"),
  );
}

/** Retorna as strings de UI proibidas encontradas num fonte (exportada para o próprio teste). */
export function varrerIdentidadeVazada(fonte: string, nomeArquivo: string): string[] {
  const sf = ts.createSourceFile(nomeArquivo, fonte, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const vazados: string[] = [];

  function considerar(texto: string) {
    if (PROIBIDO.test(texto) && !tecnico(texto)) vazados.push(texto.trim());
  }

  function visitar(no: ts.Node) {
    if (ts.isImportDeclaration(no) || ts.isExportDeclaration(no)) return; // specifiers
    if (ts.isStringLiteral(no) || ts.isNoSubstitutionTemplateLiteral(no)) {
      considerar(no.text);
    } else if (ts.isTemplateExpression(no)) {
      considerar(no.head.text);
      for (const span of no.templateSpans) considerar(span.literal.text);
      no.templateSpans.forEach((s) => visitar(s.expression));
      return;
    } else if (ts.isJsxText(no)) {
      considerar(no.text);
    }
    no.forEachChild(visitar);
  }
  visitar(sf);
  return vazados;
}

function arquivosFonte(dir: string): string[] {
  const saida: string[] = [];
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) saida.push(...arquivosFonte(caminho));
    else if (/\.(ts|tsx)$/.test(nome)) saida.push(caminho);
  }
  return saida;
}

describe("scanner (função testada com fixtures — aceite §5.2)", () => {
  test("pega literais de UI com o nome", () => {
    expect(varrerIdentidadeVazada('const x = "Ludo da Manu";', "f.tsx")).toHaveLength(1);
    expect(varrerIdentidadeVazada("const x = `Vez ${v} da Manu`;", "f.tsx")).toHaveLength(1);
    expect(varrerIdentidadeVazada("const j = <p>A Manu venceu!</p>;", "f.tsx")).toHaveLength(1);
    expect(varrerIdentidadeVazada('const s = "Bem-vinda!";', "f.tsx")).toHaveLength(1);
    expect(varrerIdentidadeVazada('const s = "Manuela";', "f.tsx")).toHaveLength(1);
  });

  test("mistura de técnico com nome solto É acusada (review PR #46)", () => {
    expect(varrerIdentidadeVazada('const x = "/manu/icon.png Manuela";', "f.tsx")).toHaveLength(1);
    expect(varrerIdentidadeVazada('const x = "manu-app-v20 Manu";', "f.tsx")).toHaveLength(1);
    expect(varrerIdentidadeVazada('const x = "a-manu-b venceu Manu";', "f.tsx")).toHaveLength(1);
  });

  test("libera identificadores técnicos", () => {
    for (const ok of [
      'const c = "bg-manu-rosa/40 ring-manu-sol";',
      'const db = "manu-jogos";',
      'const chave = "manu-jogos-ocultos";',
      'const cache = "manu-app-v20";',
      'const modo = "manu";',
      'const src = "/manu/manu-corpo.webp";',
      'import { Mascote } from "@/components/ui-kids/Mascote";',
      "// comentário falando da Manuela",
    ]) {
      expect(varrerIdentidadeVazada(ok, "f.tsx"), ok).toHaveLength(0);
    }
  });
});

describe("árvore real limpa", () => {
  test("components/, app/ e lib/ não têm identidade vazada", () => {
    const raiz = join(__dirname, "..", "..");
    const arquivos = ["components", "app", "lib"]
      .flatMap((d) => arquivosFonte(join(raiz, d)))
      .filter((f) => !f.endsWith("lib/identidade.ts"));
    const problemas: string[] = [];
    for (const arquivo of arquivos) {
      for (const vazado of varrerIdentidadeVazada(readFileSync(arquivo, "utf8"), arquivo)) {
        problemas.push(`${arquivo.replace(raiz + "/", "")}: "${vazado}"`);
      }
    }
    expect(problemas, problemas.join("\n")).toHaveLength(0);
  });
});
