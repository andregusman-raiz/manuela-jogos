import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PAGINAS_IMAGEM, buscarImagem, imagensDaCategoria } from "@/lib/colorir/imagens";
import { PAGINAS } from "@/lib/colorir/paginas";
import { CATEGORIAS } from "@/lib/colorir/tipos";

/**
 * O catálogo é GERADO (scripts/processar-banco-colorir.py): estes testes pegam
 * regeneração quebrada — slug duplicado pinta a página errada, src sem arquivo
 * vira desenho em branco para a criança.
 */
describe("catálogo de páginas bitmap", () => {
  it("tem um volume razoável de páginas (a leva inicial foi 157)", () => {
    expect(PAGINAS_IMAGEM.length).toBeGreaterThanOrEqual(100);
  });

  it("não repete slug — nem entre si, nem com as páginas-região", () => {
    const slugs = PAGINAS_IMAGEM.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    const deRegiao = new Set(PAGINAS.map((p) => p.slug));
    for (const s of slugs) expect(deRegiao.has(s), `slug ${s} colide com página-região`).toBe(false);
  });

  it("todo src aponta para um arquivo que existe em public/", () => {
    for (const p of PAGINAS_IMAGEM) {
      const caminho = join(process.cwd(), "public", p.src);
      expect(existsSync(caminho), `arquivo ausente: ${p.src}`).toBe(true);
    }
  });

  it("toda página tem categoria anunciada no seletor e dimensões válidas", () => {
    const validas = new Set(CATEGORIAS.map((c) => c.id));
    for (const p of PAGINAS_IMAGEM) {
      expect(validas.has(p.categoria), `categoria órfã: ${p.categoria}`).toBe(true);
      expect(p.largura).toBeGreaterThan(200);
      expect(p.altura).toBeGreaterThan(200);
      expect(p.nome.length).toBeGreaterThan(3);
    }
  });

  it("páginas da categoria bobbie-goods existem e apontam para a própria pasta de assets", () => {
    const bobbie = imagensDaCategoria("bobbie-goods");
    expect(bobbie.length).toBeGreaterThan(0);
    for (const p of bobbie) {
      expect(p.src.startsWith("/colorir-img/bobbie-goods/"), `pasta errada: ${p.src}`).toBe(true);
    }
  });

  it("busca por slug e por categoria funcionam", () => {
    const primeira = PAGINAS_IMAGEM[0];
    expect(buscarImagem(primeira.slug)).toEqual(primeira);
    expect(buscarImagem("nao-existe")).toBeUndefined();
    expect(buscarImagem(undefined)).toBeUndefined();
    expect(imagensDaCategoria(primeira.categoria).length).toBeGreaterThan(0);
  });
});
