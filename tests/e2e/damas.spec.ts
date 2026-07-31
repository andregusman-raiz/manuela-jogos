import { expect, test, type Page } from "@playwright/test";
import { tocarNoElemento } from "./_toque";

/**
 * Damas — SPEC onda 3 §3.4. Lances determinísticos no tabuleiro inicial
 * (as peças começam sempre nos mesmos lugares); captura hard-coded no teste.
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

async function iniciar(page: Page) {
  await tocarNoElemento(page.getByLabel("começar a partida", { exact: true }));
  await expect(page.locator("[data-casa='5-2']")).toBeVisible();
}

async function lance(page: Page, de: string, para: string) {
  await tocarNoElemento(page.locator(`[data-casa='${de}']`));
  // a casa de destino tem de estar DESTACADA como legal antes do toque
  await expect(page.locator(`[data-casa='${para}']`)).toHaveAttribute("data-destino", "true");
  await tocarNoElemento(page.locator(`[data-casa='${para}']`));
}

test.beforeEach(async ({ page }) => {
  await page.goto("/damas");
  await limparBanco(page);
  await page.reload();
  await iniciar(page);
});

test("do card do hub: abertura alterna a vez e mostra destinos legais", async ({ page }) => {
  await page.goto("/").catch(() => page.goto("/"));
  await tocarNoElemento(page.getByLabel("Damas"));
  await expect(page).toHaveURL(/\/damas/);
  await iniciar(page);

  await expect(page.locator("main")).toHaveAttribute("data-vez", "rosa");
  await lance(page, "5-2", "4-3");
  await expect(page.locator("main")).toHaveAttribute("data-vez", "azul");
  await lance(page, "2-1", "3-2");
  await expect(page.locator("main")).toHaveAttribute("data-vez", "rosa");
});

test("captura conhecida no tabuleiro inicial remove a peça azul", async ({ page }) => {
  await expect(page.locator("main")).toHaveAttribute("data-pecas-azul", "12");
  await lance(page, "5-2", "4-3"); // rosa avança
  await lance(page, "2-1", "3-2"); // azul entra no alcance
  await lance(page, "4-3", "2-1"); // rosa pula sobre 3-2

  await expect(page.locator("main")).toHaveAttribute("data-pecas-azul", "11");
  // a rosa aterrissou na casa de origem da azul
  await expect(page.locator("[data-casa='2-1'] [data-cor='rosa']")).toBeAttached();
});

test("toque em peça fora da vez não seleciona nada", async ({ page }) => {
  // é a vez da rosa: tocar uma azul não gera destinos
  await tocarNoElemento(page.locator("[data-casa='2-1']"));
  await expect(page.locator("[data-destino='true']")).toHaveCount(0);
});

test("placar persiste e soma (registro transacional)", async ({ page }) => {
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const req = indexedDB.open("manu-jogos");
        req.onsuccess = () => {
          const tx = req.result.transaction("damas", "readwrite");
          tx.objectStore("damas").put({ id: "placar", rosa: 3, azul: 1, atualizadoEm: 1 });
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
  await expect(page.locator("[data-placar-rosa]")).toHaveAttribute("data-placar-rosa", "3", {
    timeout: 5000,
  });
  await expect(page.locator("[data-placar-rosa]")).toHaveAttribute("data-placar-azul", "1");
});

test("três formatos: casas >= 44px e o tabuleiro dentro da tela", async ({ browser }) => {
  const formatos = [
    { nome: "celular 390", viewport: { width: 390, height: 844 } },
    { nome: "tablet 820", viewport: { width: 820, height: 1180 } },
    { nome: "desktop 1440", viewport: { width: 1440, height: 900 } },
  ];
  for (const formato of formatos) {
    const contexto = await browser.newContext({ viewport: formato.viewport });
    const pagina = await contexto.newPage();
    await pagina.goto("/damas");
    await tocarNoElemento(pagina.getByLabel("começar a partida", { exact: true }));
    await expect(pagina.locator("[data-casa='0-0']")).toBeVisible();

    for (const casa of ["0-0", "7-7", "3-4"]) {
      const caixa = await pagina.locator(`[data-casa='${casa}']`).boundingBox();
      expect(caixa, `${formato.nome}: casa ${casa}`).not.toBeNull();
      expect(caixa!.width, `${formato.nome}: casa estreita`).toBeGreaterThanOrEqual(44);
      expect(caixa!.height, `${formato.nome}: casa baixa`).toBeGreaterThanOrEqual(44);
      expect(caixa!.x, `${formato.nome}: fora à esquerda`).toBeGreaterThanOrEqual(0);
      expect(caixa!.y, `${formato.nome}: acima da tela`).toBeGreaterThanOrEqual(0);
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
