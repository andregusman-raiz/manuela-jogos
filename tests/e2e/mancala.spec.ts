import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { tocarNoElemento } from "./_toque";

/**
 * Mancala — SPEC §4.2. A sequência 2P foi computada OFFLINE com o motor real
 * (semente 1 da busca): 14 lances com 1 captura e 1 jogada extra; o oráculo
 * abaixo é o estado final HARD-CODED (kalahs 12×4), não recalculado.
 */

// lances na ordem em que acontecem; o dono da vez vem do próprio jogo
const SEQUENCIA = [0, 0, 4, 2, 2, 1, 0, 4, 4, 5, 2, 2, 5, 0];
const ORACULO = {
  kalahs: [12, 4] as const,
  covas0: [0, 10, 2, 9, 1, 1] as const,
  covas1: [4, 1, 0, 2, 2, 0] as const,
  vezFinal: "1",
};

async function entrar2P(page: Page) {
  await page.goto("/mancala");
  await tocarNoElemento(page.getByLabel("jogar com alguém"));
  await expect(page.locator("[data-vez]")).toBeVisible();
}

test("sequência 2P com captura e extra — placar final pelo oráculo hard-coded", async ({
  page,
}) => {
  await entrar2P(page);
  for (const [i, cova] of SEQUENCIA.entries()) {
    const vez = await page.locator("[data-vez]").getAttribute("data-vez");
    await tocarNoElemento(page.locator(`[data-cova="${vez}-${cova}"]`));
    await page.waitForTimeout(150);
    void i;
  }
  await expect(page.locator("[data-kalah='0']")).toHaveAttribute(
    "data-sementes",
    String(ORACULO.kalahs[0]),
  );
  await expect(page.locator("[data-kalah='1']")).toHaveAttribute(
    "data-sementes",
    String(ORACULO.kalahs[1]),
  );
  for (const [i, s] of ORACULO.covas0.entries()) {
    await expect(page.locator(`[data-cova="0-${i}"]`)).toHaveAttribute(
      "data-sementes",
      String(s),
    );
  }
  for (const [i, s] of ORACULO.covas1.entries()) {
    await expect(page.locator(`[data-cova="1-${i}"]`)).toHaveAttribute(
      "data-sementes",
      String(s),
    );
  }
  await expect(page.locator("[data-vez]")).toHaveAttribute("data-vez", ORACULO.vezFinal);
});

test("partida 2P até o FIM: overlay de vencedor e confete (review PR #39)", async ({ page }) => {
  test.setTimeout(120_000);
  await entrar2P(page);
  // partida completa computada offline (semente 2): 32 lances, Azul 29×19
  const lances = [
    0, 1, 3, 5, 0, 2, 0, 1, 2, 5, 4, 0, 3, 0, 0, 1, 2, 2, 5, 0, 4, 2, 1, 4, 4, 0, 0, 2, 5, 2, 5, 1,
  ];
  for (const cova of lances) {
    const vez = await page.locator("[data-vez]").getAttribute("data-vez");
    await tocarNoElemento(page.locator(`[data-cova="${vez}-${cova}"]`));
    await page.waitForTimeout(120);
  }
  await expect(page.locator("[data-vez]")).toHaveAttribute("data-situacao", "fim");
  await expect(page.getByText(/Azul venceu! 29 a 19/)).toBeVisible();
  await expect(page.locator("canvas[data-ativo='true']")).toBeAttached();
});

test("vs Manu: 3 lances legais, resposta e conservação das 48 sementes", async ({ page }) => {
  await page.goto("/mancala");
  await tocarNoElemento(page.getByLabel("jogar com a Manu"));

  const somaTotal = async () => {
    const covas = await page
      .locator("[data-cova]")
      .evaluateAll((els) => els.reduce((a, e) => a + Number(e.getAttribute("data-sementes")), 0));
    const kalahs = await page
      .locator("[data-kalah]")
      .evaluateAll((els) => els.reduce((a, e) => a + Number(e.getAttribute("data-sementes")), 0));
    return covas + kalahs;
  };

  for (let lance = 0; lance < 3; lance++) {
    await expect(page.locator("[data-vez]")).toHaveAttribute("data-vez", "0", { timeout: 5000 });
    // toca a primeira cova própria com sementes
    const covas = await page
      .locator("[data-cova^='0-']")
      .evaluateAll((els) =>
        els.map((e) => ({
          id: e.getAttribute("data-cova")!,
          sementes: Number(e.getAttribute("data-sementes")),
        })),
      );
    const cheia = covas.find((c) => c.sementes > 0)!;
    await tocarNoElemento(page.locator(`[data-cova="${cheia.id}"]`));
    await page.waitForTimeout(1100); // Manu pensa 700ms
    expect(await somaTotal(), `lance ${lance}: sementes sumiram`).toBe(48);
  }
});

test("três formatos: covas ≥44px de verdade e tabuleiro inteiro na tela", async ({ browser }) => {
  const formatos = [
    { nome: "celular", viewport: { width: 390, height: 844 } },
    { nome: "tablet", viewport: { width: 820, height: 1180 } },
    { nome: "deitado", viewport: { width: 844, height: 390 } },
  ];
  for (const formato of formatos) {
    const contexto = await browser.newContext({ viewport: formato.viewport });
    const pagina = await contexto.newPage();
    await pagina.goto("/mancala");
    await tocarNoElemento(pagina.getByLabel("jogar com alguém"));
    for (const alvo of await pagina.locator("[data-cova]").all()) {
      const caixa = await alvo.boundingBox();
      expect(caixa, `${formato.nome}: cova sem caixa`).not.toBeNull();
      expect(caixa!.width, `${formato.nome}: cova estreita`).toBeGreaterThanOrEqual(44);
      expect(caixa!.height, `${formato.nome}: cova baixa`).toBeGreaterThanOrEqual(44);
      expect(
        caixa!.y + caixa!.height,
        `${formato.nome}: cova fora da tela`,
      ).toBeLessThanOrEqual(formato.viewport.height + 1);
      expect(caixa!.x + caixa!.width, `${formato.nome}: cova vaza à direita`).toBeLessThanOrEqual(
        formato.viewport.width + 1,
      );
    }
    await contexto.close();
  }
});
