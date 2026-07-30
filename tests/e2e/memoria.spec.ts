import { expect, test, type Page } from "@playwright/test";
import { tocarNoElemento } from "./_toque";

/**
 * Jogo da Memória — SPEC §6.2: dedo real, três formatos, fluxo feliz até o
 * confete, tabuleiro travado durante a janela de 900ms, persistência.
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

/** Resolve o tabuleiro inteiro pareando pelas dicas de data-par. */
async function resolverTabuleiro(page: Page, pares: number) {
  for (let par = 0; par < pares; par++) {
    const cartas = page.locator(`[data-par="${par}"]`);
    await tocarNoElemento(cartas.first());
    await tocarNoElemento(cartas.last());
    // as duas somem juntas quando o par casa
    await expect(cartas).toHaveCount(0, { timeout: 4000 });
  }
}

test.beforeEach(async ({ page }) => {
  await page.goto("/memoria");
  await limparBanco(page);
  await page.reload();
  await expect(page.locator("[data-par]").first()).toBeVisible();
});

test("fluxo feliz: do card do hub aos 6 pares, confete e volta", async ({ page }) => {
  await page.goto("/");
  await tocarNoElemento(page.getByLabel("Jogo da Memória"));
  await expect(page).toHaveURL(/\/memoria/);
  await expect(page.locator("[data-par]")).toHaveCount(12);

  await resolverTabuleiro(page, 6);

  await expect(page.getByText("Você achou todos!")).toBeVisible();
  await expect(page.getByText("Em 6 tentativas")).toBeVisible();
  await expect(page.locator("canvas[data-ativo='true']")).toBeAttached();

  await tocarNoElemento(page.getByLabel("voltar para os jogos"));
  await expect(page).toHaveURL(/\/$/);
});

test("par errado vira de volta; terceira carta na janela é ignorada", async ({ page }) => {
  // duas cartas de pares DIFERENTES
  const a = page.locator(`[data-par="0"]`).first();
  const b = page.locator(`[data-par="1"]`).first();
  await tocarNoElemento(a);
  await expect(a).toHaveAttribute("data-estado", "aberta");
  await tocarNoElemento(b);
  await expect(page.locator("[data-tentativas]")).toHaveAttribute("data-tentativas", "1");

  // janela de 900ms: tocar uma TERCEIRA carta não conta tentativa nem abre
  const c = page.locator(`[data-par="2"]`).first();
  await tocarNoElemento(c);
  await expect(c).toHaveAttribute("data-estado", "fechada");
  await expect(page.locator("[data-tentativas]")).toHaveAttribute("data-tentativas", "1");

  // depois da janela, as duas viram de volta e nada foi removido
  await expect(a).toHaveAttribute("data-estado", "fechada", { timeout: 3000 });
  await expect(b).toHaveAttribute("data-estado", "fechada");
  await expect(page.locator("[data-par]")).toHaveCount(12);

  // e o tabuleiro continua jogável
  const par = page.locator(`[data-par="3"]`);
  await tocarNoElemento(par.first());
  await tocarNoElemento(par.last());
  await expect(par).toHaveCount(0, { timeout: 4000 });
});

test("persistência: nível liberado sobrevive ao reload", async ({ page }) => {
  await expect(page.locator("main")).toHaveAttribute("data-nivel", "1");
  await resolverTabuleiro(page, 6);
  await expect(page.getByText("Você achou todos!")).toBeVisible();

  await page.reload();
  await expect(page.locator("main")).toHaveAttribute("data-nivel", "2", { timeout: 5000 });
  // nível 2 tem 8 pares = 16 cartas
  await expect(page.locator("[data-par]")).toHaveCount(16);
});

test("três formatos: cartas >= 72px e dentro da tela", async ({ browser }) => {
  const formatos = [
    { nome: "celular 390", viewport: { width: 390, height: 844 } },
    { nome: "tablet 820", viewport: { width: 820, height: 1180 } },
    { nome: "desktop 1440", viewport: { width: 1440, height: 900 } },
  ];
  for (const formato of formatos) {
    const contexto = await browser.newContext({ viewport: formato.viewport });
    const pagina = await contexto.newPage();
    await pagina.goto("/memoria");
    await expect(pagina.locator("[data-par]").first()).toBeVisible();

    for (const carta of await pagina.locator("[data-par]").all()) {
      const caixa = await carta.boundingBox();
      expect(caixa, `${formato.nome}: carta sem caixa`).not.toBeNull();
      expect(caixa!.width, `${formato.nome}: carta estreita`).toBeGreaterThanOrEqual(72);
      expect(caixa!.height, `${formato.nome}: carta baixa`).toBeGreaterThanOrEqual(72);
      expect(caixa!.x, `${formato.nome}: carta fora à esquerda`).toBeGreaterThanOrEqual(0);
      expect(caixa!.y, `${formato.nome}: carta acima da tela`).toBeGreaterThanOrEqual(0);
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
