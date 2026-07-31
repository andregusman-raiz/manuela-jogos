import { expect, test, type Page } from "@playwright/test";
import { tocarNoElemento } from "./_toque";

/**
 * Palavra Mágica — SPEC §6.2: dedo real, três formatos, fluxo feliz até o
 * confete, erro que não troca a palavra e persistência de nível.
 */

async function limparBanco(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const req = indexedDB.deleteDatabase("manu-jogos");
        req.onsuccess = req.onerror = req.onblocked = () => resolve();
      }),
  );
}

/** Acerta a rodada atual lendo a resposta exposta para o teste. */
async function acertarUma(page: Page, rodada: number) {
  const resposta = await page.locator("[data-resposta]").getAttribute("data-resposta");
  await tocarNoElemento(page.getByLabel(`opção ${resposta}`, { exact: true }));
  await expect(page.locator("[data-acertos]")).toHaveAttribute(
    "data-acertos",
    String(rodada + 1),
    { timeout: 4000 },
  );
}

test.beforeEach(async ({ page }) => {
  await page.goto("/palavras");
  await limparBanco(page);
  await page.reload();
  await expect(page.locator("[data-resposta]")).toBeVisible();
});

test("fluxo feliz: do card do hub às 8 palavras, confete e volta", async ({ page }) => {
  await page.goto("/");
  await tocarNoElemento(page.getByLabel("Palavra Mágica"));
  await expect(page).toHaveURL(/\/palavras/);
  await expect(page.locator("[data-resposta]")).toBeVisible();

  for (let i = 0; i < 8; i++) await acertarUma(page, i);

  await expect(page.getByText("Você completou todas!")).toBeVisible();
  await expect(page.locator("canvas[data-ativo='true']")).toBeAttached();

  await tocarNoElemento(page.getByLabel("voltar para os jogos"));
  await expect(page).toHaveURL(/\/$/);
});

test("erro: shake, a palavra PERMANECE e a certa continua valendo", async ({ page }) => {
  const resposta = await page.locator("[data-resposta]").getAttribute("data-resposta");
  const rotulos = await page
    .locator("[aria-label^='opção ']")
    .evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
  const errada = rotulos.find((r) => r !== `opção ${resposta}`)!;

  await tocarNoElemento(page.getByLabel(errada, { exact: true }));
  await expect(page.locator("[data-acertos]")).toHaveAttribute("data-acertos", "0");
  await expect(page.locator("[data-resposta]")).toHaveAttribute("data-resposta", resposta!);

  await acertarUma(page, 0);
});

test("persistência: subir de nível sobrevive ao reload", async ({ page }) => {
  await expect(page.locator("main")).toHaveAttribute("data-nivel", "1");
  for (let i = 0; i < 8; i++) await acertarUma(page, i);
  await tocarNoElemento(page.getByLabel("mais difícil"));
  await expect(page.locator("main")).toHaveAttribute("data-nivel", "2");

  await page.reload();
  await expect(page.locator("main")).toHaveAttribute("data-nivel", "2", { timeout: 5000 });
  await expect(page.locator("[data-resposta]")).toBeVisible();
});

test("nível 3 pede SÍLABA e a lacuna recorta a palavra certa", async ({ page }) => {
  // libera o nível 3 direto via progresso salvo
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const req = indexedDB.open("manu-jogos");
        req.onsuccess = () => {
          const tx = req.result.transaction("palavras", "readwrite");
          tx.objectStore("palavras").put({ id: "progresso", nivel: 3, melhor: null, atualizadoEm: 1 });
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
  await expect(page.locator("main")).toHaveAttribute("data-nivel", "3");
  // o reload do controllerchange do SW pode atropelar a interação — retry
  // (padrão de estabilidade do contas/lojinha.spec)
  await expect(async () => {
    // sílaba elegível tem SEMPRE 2+ letras — nível 3 mutado para letra falha
    const resposta = await page.locator("[data-resposta]").getAttribute("data-resposta");
    expect(resposta!.length, "nível 3 pede sílaba, não letra").toBeGreaterThanOrEqual(2);
    await acertarUma(page, 0);
  }).toPass({ timeout: 20000 });
});

test("três formatos: opções >= 72px e dentro da tela", async ({ browser }) => {
  const formatos = [
    { nome: "celular 390", viewport: { width: 390, height: 844 } },
    { nome: "tablet 820", viewport: { width: 820, height: 1180 } },
    { nome: "desktop 1440", viewport: { width: 1440, height: 900 } },
  ];
  for (const formato of formatos) {
    const contexto = await browser.newContext({ viewport: formato.viewport });
    const pagina = await contexto.newPage();
    await pagina.goto("/palavras");
    await expect(pagina.locator("[data-resposta]")).toBeVisible();

    for (const alvo of await pagina.locator("[aria-label^='opção ']").all()) {
      const caixa = await alvo.boundingBox();
      expect(caixa, `${formato.nome}: opção sem caixa`).not.toBeNull();
      expect(caixa!.width, `${formato.nome}: opção estreita`).toBeGreaterThanOrEqual(72);
      expect(caixa!.height, `${formato.nome}: opção baixa`).toBeGreaterThanOrEqual(72);
      expect(caixa!.x, `${formato.nome}: fora à esquerda`).toBeGreaterThanOrEqual(0);
      expect(caixa!.x + caixa!.width, `${formato.nome}: vaza à direita`).toBeLessThanOrEqual(
        formato.viewport.width,
      );
      expect(caixa!.y + caixa!.height, `${formato.nome}: vaza abaixo`).toBeLessThanOrEqual(
        formato.viewport.height,
      );
    }
    await contexto.close();
  }
});
