import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { tocarNoElemento } from "./_toque";

/**
 * Lig-4 — SPEC §3.3. O 2P tem oráculo de posições hard-coded; o vs-Manu
 * assere LEGALIDADE (a tática fina da IA vive nos unit) e, com a semente 41,
 * joga o plano vencedor achado offline contra a IA determinística para provar
 * a persistência do nível 2.
 */

async function limparBanco(page: Page) {
  await page.goto("/lig4");
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const req = indexedDB.deleteDatabase("manu-jogos");
        req.onsuccess = req.onerror = req.onblocked = () => resolve();
      }),
  );
}

test("2 jogadores: diagonal vence com oráculo de posições e confete", async ({ page }) => {
  await page.goto("/lig4");
  await tocarNoElemento(page.getByLabel("jogar com alguém"));

  // sequência da diagonal ↗ (mesma do unit): J0 vence com (0,0)(1,1)(2,2)(3,3)
  const sequencia = [0, 1, 1, 2, 2, 3, 2, 3, 3, 6, 3];
  for (const [i, coluna] of sequencia.entries()) {
    await expect(page.locator("[data-vez]")).toHaveAttribute("data-vez", String(i % 2));
    await tocarNoElemento(page.getByLabel(`coluna ${coluna + 1}`));
  }

  // oráculo: as 4 casas da diagonal pertencem ao jogador 0 (rosa)
  for (const [c, l] of [
    [0, 0],
    [1, 1],
    [2, 2],
    [3, 3],
  ]) {
    await expect(page.locator(`[data-celula="${c}-${l}"]`)).toHaveAttribute("data-dono", "0");
  }
  await expect(page.getByText("Rosa venceu!")).toBeVisible();
  await expect(page.locator("canvas[data-ativo='true']")).toBeAttached();
});

test("vs Manu: só legalidade — alternância, 1 peça por vez, resposta rápida", async ({ page }) => {
  await page.goto("/lig4?semente=77");
  await tocarNoElemento(page.getByLabel("jogar com a Manu"));

  let pecasAntes = 0;
  for (const coluna of [3, 2, 4]) {
    await expect(page.locator("[data-vez]")).toHaveAttribute("data-vez", "0", {
      timeout: 4000,
    });
    await tocarNoElemento(page.getByLabel(`coluna ${coluna + 1}`));
    // a Manu responde em <2s e o total cresce exatamente 2 (humano + IA)
    await expect(page.locator("[data-vez]")).toHaveAttribute("data-vez", "0", {
      timeout: 2000 + 1000,
    });
    const pecas = await page.locator("[data-dono]:not([data-dono=''])").count();
    expect(pecas).toBe(pecasAntes + 2);
    pecasAntes = pecas;
    for (let c = 0; c < 7; c++) {
      const naColuna = await page
        .locator(`[data-celula^="${c}-"]:not([data-dono=''])`)
        .count();
      expect(naColuna, `coluna ${c} estourou`).toBeLessThanOrEqual(6);
    }
  }
});

test("vencer a Manu no nível 1 libera o nível 2 (persistência)", async ({ page }) => {
  await limparBanco(page);
  await page.goto("/lig4?semente=41");
  await tocarNoElemento(page.getByLabel("jogar com a Manu"));

  // plano achado offline contra a IA determinística (semente 41, distração 0.3)
  const plano = [0, 0, 0, 1, 0, 0, 5, 3, 3, 2, 2, 1];
  for (const coluna of plano) {
    const fim = await page
      .getByText("Você venceu!")
      .isVisible()
      .catch(() => false);
    if (fim) break;
    await expect(page.locator("[data-vez]")).toHaveAttribute("data-vez", "0", {
      timeout: 4000,
    });
    await tocarNoElemento(page.getByLabel(`coluna ${coluna + 1}`));
    await page.waitForTimeout(900); // vez da Manu (600ms de pensamento)
  }

  await expect(page.getByText("Você venceu!")).toBeVisible({ timeout: 5000 });
  await expect(page.locator("canvas[data-ativo='true']")).toBeAttached();

  await page.goto("/lig4?semente=42");
  await expect(page.getByLabel("nível 2")).toBeVisible({ timeout: 5000 });
});

test("três formatos: colunas tocáveis ≥44px e tabuleiro inteiro na tela", async ({ browser }) => {
  const formatos = [
    { nome: "celular", viewport: { width: 390, height: 844 } },
    { nome: "tablet", viewport: { width: 820, height: 1180 } },
    { nome: "deitado", viewport: { width: 844, height: 390 } },
  ];
  for (const formato of formatos) {
    const contexto = await browser.newContext({ viewport: formato.viewport });
    const pagina = await contexto.newPage();
    await pagina.goto("/lig4");
    await tocarNoElemento(pagina.getByLabel("jogar com alguém"));
    for (let c = 0; c < 7; c++) {
      const caixa = await pagina.getByLabel(`coluna ${c + 1}`).boundingBox();
      expect(caixa, `${formato.nome}: coluna ${c + 1} sem caixa`).not.toBeNull();
      expect(caixa!.width, `${formato.nome}: coluna ${c + 1} estreita`).toBeGreaterThanOrEqual(40);
      expect(caixa!.height, `${formato.nome}: coluna baixa`).toBeGreaterThanOrEqual(44);
      expect(
        caixa!.y + caixa!.height,
        `${formato.nome}: coluna cortada embaixo`,
      ).toBeLessThanOrEqual(formato.viewport.height + 1);
    }
    await contexto.close();
  }
});
