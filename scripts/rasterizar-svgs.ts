/**
 * Rasteriza os SVGs do banco-colorir em PNG 1200px usando o Chromium do
 * Playwright. Tudo local: lê do disco, desenha num canvas, salva no disco.
 */
import { chromium } from "@playwright/test";
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, basename } from "node:path";
import { homedir } from "node:os";

const BANCO = join(homedir(), "Pictures/banco-colorir");
const SAIDA = join(
  "/private/tmp/claude-501/-Users-andregusmandeoliveira-Claude/26f2dfa8-325f-4bd8-bc2b-e99cba28edae/scratchpad",
  "svg-raster",
);

async function main() {
  mkdirSync(SAIDA, { recursive: true });
  const navegador = await chromium.launch();
  const pagina = await navegador.newPage();

  const pastas = readdirSync(BANCO, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  let ok = 0;
  let falha = 0;
  for (const pasta of pastas) {
    const svgs = readdirSync(join(BANCO, pasta)).filter((f) => f.endsWith(".svg"));
    mkdirSync(join(SAIDA, pasta), { recursive: true });
    for (const arquivo of svgs) {
      const texto = readFileSync(join(BANCO, pasta, arquivo), "utf8");
      try {
        const dataUrl: string = await pagina.evaluate(async (svgTexto) => {
          const blob = new Blob([svgTexto], { type: "image/svg+xml" });
          const url = URL.createObjectURL(blob);
          const img = await new Promise<HTMLImageElement>((res, rej) => {
            const i = new Image();
            i.onload = () => res(i);
            i.onerror = () => rej(new Error("svg não carregou"));
            i.src = url;
          });
          const larguraBase = img.naturalWidth || 800;
          const alturaBase = img.naturalHeight || 800;
          const escala = 1200 / Math.max(larguraBase, alturaBase);
          const c = document.createElement("canvas");
          c.width = Math.round(larguraBase * escala);
          c.height = Math.round(alturaBase * escala);
          const ctx = c.getContext("2d")!;
          ctx.fillStyle = "#FFFFFF";
          ctx.fillRect(0, 0, c.width, c.height);
          ctx.drawImage(img, 0, 0, c.width, c.height);
          URL.revokeObjectURL(url);
          return c.toDataURL("image/png");
        }, texto);
        const png = Buffer.from(dataUrl.split(",")[1], "base64");
        writeFileSync(join(SAIDA, pasta, basename(arquivo, ".svg") + ".png"), png);
        ok++;
      } catch {
        console.log(`FALHA: ${pasta}/${arquivo}`);
        falha++;
      }
    }
  }
  await navegador.close();
  console.log(`rasterizados: ${ok}, falhas: ${falha}`);
}

void main();
