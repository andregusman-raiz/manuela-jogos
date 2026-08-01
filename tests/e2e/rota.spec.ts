import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { tocarNoElemento } from "./_toque";

/**
 * Roda Romana — SPEC §5. Sequências fixas dos unit tests reproduzidas na UI:
 * vitória por arco na colocação, por diâmetro no movimento, e o empate por
 * repetição do juiz (blocker J10). O bloqueio da Manu usa a posição forçada
 * (ramo determinístico da IA — sem sorte envolvida).
 */

async function entrar(page: Page, modo: "jogar com alguém" | "jogar com a Manu") {
  await page.goto("/rota?semente=33333");
  await tocarNoElemento(page.getByLabel(modo));
  await expect(page.locator("[data-vez]")).toBeVisible();
}

async function tocarCasa(page: Page, casa: number) {
  await tocarNoElemento(page.locator(`circle[data-casa="${casa}"]`));
  await page.waitForTimeout(120);
}

test("vitória por ARCO na colocação (2P) com confete", async ({ page }) => {
  await entrar(page, "jogar com alguém");
  for (const casa of [0, 4, 1, 6, 2]) await tocarCasa(page, casa);
  await expect(page.locator("[data-vez]")).toHaveAttribute("data-situacao", "fim");
  await expect(page.getByText("Rosa venceu!")).toBeVisible();
  await expect(page.locator("canvas[data-ativo='true']")).toBeAttached();
});

test("vitória por DIÂMETRO na fase de movimento (2P)", async ({ page }) => {
  await entrar(page, "jogar com alguém");
  for (const casa of [0, 1, 4, 3, 6, 5]) await tocarCasa(page, casa);
  await expect(page.locator("[data-vez]")).toHaveAttribute("data-fase", "movimento");
  await tocarCasa(page, 6); // seleciona a peça rosa da casa 6
  await expect(page.locator(`circle[data-casa="6"]`)).toHaveAttribute("data-selecionada", "true");
  await tocarCasa(page, 8); // move ao centro: fecha 0-8-4
  await expect(page.getByText("Rosa venceu!")).toBeVisible();
});

test("empate por repetição: o ciclo do juiz fecha com 'Empatou!'", async ({ page }) => {
  test.setTimeout(120_000);
  await entrar(page, "jogar com alguém");
  for (const casa of [0, 1, 2, 3, 4, 5]) await tocarCasa(page, casa);
  const ciclo: Array<[number, number]> = [
    [4, 8],
    [5, 6],
    [8, 4],
    [6, 5],
  ];
  for (let volta = 0; volta < 2; volta++) {
    for (const [de, para] of ciclo) {
      await tocarCasa(page, de);
      await tocarCasa(page, para);
    }
  }
  await expect(page.locator("[data-vez]")).toHaveAttribute("data-situacao", "empate");
  await expect(page.getByText(/Empatou!/)).toBeVisible();
  // empate NÃO comemora: confete não dispara
  await expect(page.locator("canvas[data-ativo='true']")).toHaveCount(0);
});

test("vs Manu: bloqueia a vitória iminente (ramo determinístico)", async ({ page }) => {
  await entrar(page, "jogar com a Manu");
  // semente 33333: 1ª jogada aleatória da Manu = casa 3 (não atrapalha);
  // humano coloca 0 e 1 → ameaça arco em 2 e 7; a Manu DEVE ocupar 2 ou 7
  await tocarCasa(page, 0);
  await page.waitForTimeout(1100); // Manu coloca em algum lugar
  await tocarCasa(page, 1);
  await page.waitForTimeout(1100);
  const dono2 = await page.locator(`circle[data-casa="2"]`).getAttribute("data-dono");
  const dono7 = await page.locator(`circle[data-casa="7"]`).getAttribute("data-dono");
  expect(
    dono2 === "1" || dono7 === "1",
    `Manu não bloqueou (casa2=${dono2}, casa7=${dono7})`,
  ).toBe(true);
});

test("três formatos: casas ≥44px e roda inteira na tela", async ({ browser }) => {
  const formatos = [
    { nome: "celular", viewport: { width: 390, height: 844 } },
    { nome: "tablet", viewport: { width: 820, height: 1180 } },
    { nome: "deitado", viewport: { width: 844, height: 390 } },
  ];
  for (const formato of formatos) {
    const contexto = await browser.newContext({ viewport: formato.viewport });
    const pagina = await contexto.newPage();
    await pagina.goto("/rota");
    await tocarNoElemento(pagina.getByLabel("jogar com alguém"));
    for (let casa = 0; casa < 9; casa++) {
      const caixa = await pagina.locator(`circle[data-casa="${casa}"]`).boundingBox();
      expect(caixa, `${formato.nome}: casa ${casa} sem caixa`).not.toBeNull();
      expect(caixa!.width, `${formato.nome}: casa ${casa} pequena`).toBeGreaterThanOrEqual(44);
      expect(caixa!.y, `${formato.nome}: casa acima da tela`).toBeGreaterThanOrEqual(0);
      expect(
        caixa!.y + caixa!.height,
        `${formato.nome}: casa abaixo da tela`,
      ).toBeLessThanOrEqual(formato.viewport.height + 1);
    }
    await contexto.close();
  }
});
