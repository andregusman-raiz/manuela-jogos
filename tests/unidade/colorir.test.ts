import { describe, expect, it } from "vitest";
import { PAGINAS, buscarPagina, paginasDaCategoria } from "@/lib/colorir/paginas";
import { CATEGORIAS, paginaParaSvg } from "@/lib/colorir/tipos";

/**
 * O livro de colorir é dado, e dado errado aqui quebra a pintura de forma
 * silenciosa: duas regiões com o mesmo id fazem uma pintar a outra, e uma página
 * sem região deixa a criança tocando numa tela que não responde.
 */
describe("páginas do livro de colorir", () => {
  it("não repete slug", () => {
    const slugs = PAGINAS.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("dá id único para cada região dentro da página", () => {
    for (const pagina of PAGINAS) {
      const ids = pagina.regioes.map((r) => r.id);
      expect(new Set(ids).size, `ids repetidos em ${pagina.slug}`).toBe(ids.length);
    }
  });

  it("tem pelo menos 4 regiões pintáveis por desenho", () => {
    for (const pagina of PAGINAS) {
      expect(pagina.regioes.length, `${pagina.slug} tem poucas regiões`).toBeGreaterThanOrEqual(4);
    }
  });

  it("dá nome a toda região (é o rótulo do leitor de tela)", () => {
    for (const pagina of PAGINAS) {
      for (const regiao of pagina.regioes) {
        expect(regiao.nome.length, `${pagina.slug}/${regiao.id} sem nome`).toBeGreaterThan(2);
        expect(regiao.formas.length, `${pagina.slug}/${regiao.id} sem forma`).toBeGreaterThan(0);
      }
    }
  });

  it("mantém as formas dentro da moldura do desenho", () => {
    for (const pagina of PAGINAS) {
      for (const regiao of pagina.regioes) {
        for (const forma of regiao.formas) {
          if (forma.t === "circulo") {
            expect(forma.cx - forma.r, `${pagina.slug}/${regiao.id}`).toBeGreaterThan(-20);
            expect(forma.cx + forma.r, `${pagina.slug}/${regiao.id}`).toBeLessThan(pagina.lado + 20);
          }
          if (forma.t === "retangulo") {
            expect(forma.x + forma.l).toBeLessThanOrEqual(pagina.lado + 20);
            expect(forma.y + forma.a).toBeLessThanOrEqual(pagina.lado + 20);
          }
        }
      }
    }
  });

  it("cobre todas as categorias anunciadas no seletor", () => {
    for (const categoria of CATEGORIAS) {
      expect(paginasDaCategoria(categoria.id).length, `categoria ${categoria.id} vazia`)
        .toBeGreaterThan(0);
    }
  });

  it("acha página por slug e devolve undefined quando não existe", () => {
    expect(buscarPagina("gato")?.nome).toBe("Gatinho");
    expect(buscarPagina("nao-existe")).toBeUndefined();
    expect(buscarPagina(undefined)).toBeUndefined();
  });
});

describe("exportação para SVG", () => {
  const gato = buscarPagina("gato")!;

  it("aplica a cor pintada e deixa o resto branco", () => {
    const svg = paginaParaSvg(gato, { cabeca: "#FF0000" });
    expect(svg).toContain('viewBox="0 0 200 200"');
    expect(svg).toContain('fill="#FF0000"');
    // regiões não pintadas viram branco no PNG (papel), não transparente
    expect(svg).toContain('fill="#FFFFFF"');
  });

  it("mantém os detalhes sem preenchimento (olho não é pintável)", () => {
    const svg = paginaParaSvg(gato, {});
    expect(svg).toContain('fill="none"');
    expect(svg).toContain('stroke="#2E1408"');
  });

  it("gera markup fechado e sem regiões perdidas", () => {
    const svg = paginaParaSvg(gato, {});
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg.endsWith("</svg>")).toBe(true);
    const grupos = svg.match(/<g /g) ?? [];
    expect(grupos.length).toBe(1 + gato.regioes.length + (gato.detalhes?.length ?? 0));
  });
});
