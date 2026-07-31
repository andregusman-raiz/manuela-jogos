import { expect, test, type Page } from "@playwright/test";
import { gerarFase } from "@/lib/forca/motor";
import { tocarNoElemento } from "./_toque";

/**
 * Forca da Manu — SPEC onda 2 §3.1: dedo real, teclado 48px+ dentro da tela,
 * perder não trava a fase, acentos de graça, persistência.
 */

function bases(palavra: string): string[] {
  return [
    ...new Set(
      [...palavra].map((c) =>
        c
          .normalize("NFD")
          .replace(/[̀-ͯ]/g, "")
          .toUpperCase(),
      ),
    ),
  ];
}

async function limparBanco(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const req = indexedDB.deleteDatabase("manu-jogos");
        req.onsuccess = req.onerror = req.onblocked = () => resolve();
      }),
  );
}

/** Ganha a palavra atual tocando as letras dela. */
async function ganharPalavra(page: Page) {
  const palavra = (await page.locator("[data-palavra]").getAttribute("data-palavra"))!;
  const jogadas = Number(await page.locator("[data-jogadas]").getAttribute("data-jogadas"));
  for (const letra of bases(palavra)) {
    await tocarNoElemento(page.getByLabel(`letra ${letra}`, { exact: true }));
  }
  await expect(page.locator("[data-jogadas]")).toHaveAttribute(
    "data-jogadas",
    String(jogadas + 1),
    { timeout: 4000 },
  );
  // espera o interstício passar (próxima palavra ou tela final)
  await page.waitForTimeout(1600);
}

/** Perde a palavra atual errando 6 letras fora dela — e PROVA o interstício. */
async function perderPalavra(page: Page) {
  const palavra = (await page.locator("[data-palavra]").getAttribute("data-palavra"))!;
  const certas = new Set(bases(palavra));
  const jogadas = Number(await page.locator("[data-jogadas]").getAttribute("data-jogadas"));
  let erradas = 0;
  let ultima = "";
  for (const letra of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") {
    if (erradas === 6) break;
    if (certas.has(letra)) continue;
    await tocarNoElemento(page.getByLabel(`letra ${letra}`, { exact: true }));
    erradas++;
    ultima = letra;
  }
  await expect(page.locator("[data-jogadas]")).toHaveAttribute(
    "data-jogadas",
    String(jogadas + 1),
    { timeout: 4000 },
  );
  // interstício de derrota: a palavra se revela na tela e o teclado trava
  await expect(page.getByText(`Era ${palavra}!`)).toBeVisible();
  await expect(page.getByLabel(`letra ${ultima}`, { exact: true })).toBeDisabled();
  await page.waitForTimeout(1600);
}

test.beforeEach(async ({ page }) => {
  await page.goto("/forca");
  await limparBanco(page);
  await page.reload();
  await expect(page.locator("[data-palavra]")).toBeVisible();
});

test("fluxo feliz: do card do hub às 6 palavras, confete e volta", async ({ page }) => {
  await page.goto("/");
  await tocarNoElemento(page.getByLabel("Forca da Manu"));
  await expect(page).toHaveURL(/\/forca/);
  await expect(page.locator("[data-palavra]")).toBeVisible();

  for (let i = 0; i < 6; i++) await ganharPalavra(page);

  await expect(page.getByText("Você acertou 6 de 6!")).toBeVisible();
  await expect(page.locator("canvas[data-ativo='true']")).toBeAttached();
  await expect(page.getByLabel("mais difícil")).toBeVisible();

  await tocarNoElemento(page.getByLabel("voltar para os jogos"));
  await expect(page).toHaveURL(/\/$/);
});

test("perder uma palavra revela, avança e a fase ainda fecha", async ({ page }) => {
  await perderPalavra(page);
  await expect(page.locator("[data-ganhas]")).toHaveAttribute("data-ganhas", "0");
  // o jogo seguiu para a 2ª palavra
  await expect(page.locator("[data-erros]")).toHaveAttribute("data-erros", "0");

  for (let i = 0; i < 5; i++) await ganharPalavra(page);
  await expect(page.getByText("Você acertou 5 de 6!")).toBeVisible();
  await expect(page.locator("canvas[data-ativo='true']")).toBeAttached();
  // com 5 >= 4 ganhas o "mais difícil" aparece
  await expect(page.getByLabel("mais difícil")).toBeVisible();
});

test("acento de graça: palavra com acento é ganhável só com letras-base", async ({ page }) => {
  // seed DETERMINÍSTICO cuja 1ª palavra do nível 2 tem diacrítico — sem isso
  // ~73% das execuções sorteiam ASCII puro e o NFD não é exercitado no fluxo
  let seedComAcento = 0;
  for (let c = 1; c < 500; c++) {
    const primeira = gerarFase(2, c).fila[0].palavra;
    if (primeira !== primeira.normalize("NFD").replace(/[̀-ͯ]/g, "")) {
      seedComAcento = c;
      break;
    }
  }
  expect(seedComAcento).toBeGreaterThan(0);
  await page.addInitScript((seed) => {
    // o componente semeia com Date.now(); fixar torna a fase conhecida
    Date.now = () => seed;
  }, seedComAcento);

  // libera o nível 2 (palavras acentuadas) via progresso salvo
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const req = indexedDB.open("manu-jogos");
        req.onsuccess = () => {
          const tx = req.result.transaction("forca", "readwrite");
          tx.objectStore("forca").put({ id: "progresso", nivel: 2, melhor: null, atualizadoEm: 1 });
          tx.oncomplete = () => {
            req.result.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
        req.onerror = () => reject(req.error);
      }),
  );
  await page.reload();
  await expect(page.locator("main")).toHaveAttribute("data-nivel", "2");
  // a 1ª palavra é ACENTUADA por construção do seed; ganhá-la usando SÓ o
  // teclado A-Z prova o NFD no fluxo real
  const palavra = (await page.locator("[data-palavra]").getAttribute("data-palavra"))!;
  expect(palavra).not.toBe(palavra.normalize("NFD").replace(/[̀-ͯ]/g, ""));
  await ganharPalavra(page);
  await expect(page.locator("[data-ganhas]")).toHaveAttribute("data-ganhas", "1");
});

test("persistência: nível 2 liberado sobrevive ao reload", async ({ page }) => {
  for (let i = 0; i < 6; i++) await ganharPalavra(page);
  await tocarNoElemento(page.getByLabel("mais difícil"));
  await expect(page.locator("main")).toHaveAttribute("data-nivel", "2");

  await page.reload();
  await expect(page.locator("main")).toHaveAttribute("data-nivel", "2", { timeout: 5000 });
});

test("três formatos: 26 teclas >= 48px e DENTRO da tela", async ({ browser }) => {
  const formatos = [
    { nome: "celular 390", viewport: { width: 390, height: 844 } },
    { nome: "tablet 820", viewport: { width: 820, height: 1180 } },
    { nome: "desktop 1440", viewport: { width: 1440, height: 900 } },
  ];
  for (const formato of formatos) {
    const contexto = await browser.newContext({ viewport: formato.viewport });
    const pagina = await contexto.newPage();
    await pagina.goto("/forca");
    await expect(pagina.locator("[data-palavra]")).toBeVisible();

    for (const letra of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") {
      const caixa = await pagina.getByLabel(`letra ${letra}`, { exact: true }).boundingBox();
      expect(caixa, `${formato.nome}: tecla ${letra} sem caixa`).not.toBeNull();
      expect(caixa!.width, `${formato.nome}: tecla ${letra} estreita`).toBeGreaterThanOrEqual(48);
      expect(caixa!.height, `${formato.nome}: tecla ${letra} baixa`).toBeGreaterThanOrEqual(48);
      expect(caixa!.x, `${formato.nome}: ${letra} fora à esquerda`).toBeGreaterThanOrEqual(0);
      expect(caixa!.x + caixa!.width, `${formato.nome}: ${letra} vaza à direita`).toBeLessThanOrEqual(
        formato.viewport.width,
      );
      expect(caixa!.y, `${formato.nome}: ${letra} acima da tela`).toBeGreaterThanOrEqual(0);
      expect(caixa!.y + caixa!.height, `${formato.nome}: ${letra} abaixo da dobra`).toBeLessThanOrEqual(
        formato.viewport.height,
      );
    }
    await contexto.close();
  }
});
