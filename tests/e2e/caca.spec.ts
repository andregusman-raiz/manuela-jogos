import { expect, test, type Page } from "@playwright/test";
import { tocarNoElemento } from "./_toque";

/**
 * Caça-Números — SPEC onda 3 §3.5. O TESTE recalcula par/múltiplo/fator com
 * aritmética própria (oráculo independente) e caça todos os certos.
 */

function certoOraculo(instrucao: string, n: number): boolean {
  if (instrucao === "pares") return n % 2 === 0;
  if (instrucao === "impares") return n % 2 === 1;
  const [tipo, alvoStr] = instrucao.split("-");
  const alvo = Number(alvoStr);
  return tipo === "multiplos" ? n % alvo === 0 : alvo % n === 0;
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

/** Caça todos os certos da rodada atual com o oráculo do teste. */
async function cacarRodada(page: Page, rodada: number) {
  const instrucao = (await page.locator("[data-instrucao]").getAttribute("data-instrucao"))!;
  const numeros = await page
    .locator("[data-numero]")
    .evaluateAll((els) => els.map((e) => Number(e.getAttribute("data-numero"))));
  const certos = numeros.filter((n) => certoOraculo(instrucao, n));
  for (const n of certos) {
    await tocarNoElemento(page.locator(`[data-numero='${n}'][data-estado='livre']`).first());
  }
  await expect(page.locator("[data-rodadas]")).toHaveAttribute("data-rodadas", String(rodada + 1), {
    timeout: 5000,
  });
}

test.beforeEach(async ({ page }) => {
  await page.goto("/caca");
  await limparBanco(page);
  await page.reload();
  await expect(page.locator("[data-instrucao]")).toBeVisible();
});

test("fluxo feliz: do card do hub às 6 rodadas caçadas, confete", async ({ page }) => {
  test.setTimeout(120000);
  await page.goto("/").catch(() => page.goto("/"));
  await tocarNoElemento(page.getByLabel("Caça-Números"));
  await expect(page).toHaveURL(/\/caca/);
  await expect(page.locator("[data-instrucao]")).toBeVisible();

  for (let i = 0; i < 6; i++) await cacarRodada(page, i);

  await expect(page.getByText("Caçador de números!")).toBeVisible();
  await expect(page.locator("canvas[data-ativo='true']")).toBeAttached();

  await tocarNoElemento(page.getByLabel("voltar para os jogos"));
  await expect(page).toHaveURL(/\/$/);
});

test("errado treme e FICA; certo vira estrela e desabilita", async ({ page }) => {
  const instrucao = (await page.locator("[data-instrucao]").getAttribute("data-instrucao"))!;
  const numeros = await page
    .locator("[data-numero]")
    .evaluateAll((els) => els.map((e) => Number(e.getAttribute("data-numero"))));
  const errado = numeros.find((n) => !certoOraculo(instrucao, n))!;
  const certo = numeros.find((n) => certoOraculo(instrucao, n))!;
  const restantes = Number(await page.locator("[data-restantes]").getAttribute("data-restantes"));

  await tocarNoElemento(page.locator(`[data-numero='${errado}']`).first());
  await expect(page.locator(`[data-numero='${errado}']`).first()).toHaveAttribute(
    "data-estado",
    "livre",
  );
  await expect(page.locator("[data-restantes]")).toHaveAttribute(
    "data-restantes",
    String(restantes),
  );

  await tocarNoElemento(page.locator(`[data-numero='${certo}'][data-estado='livre']`).first());
  await expect(page.locator(`[data-numero='${certo}']`).first()).toHaveAttribute(
    "data-estado",
    "achado",
  );
  await expect(page.locator(`[data-numero='${certo}']`).first()).toBeDisabled();
});

test("níveis 2 e 3 via progresso salvo (múltiplos e fatores)", async ({ page }) => {
  test.setTimeout(90000);
  for (const nivel of [2, 3]) {
    await page.evaluate(
      (n) =>
        new Promise<void>((resolve, reject) => {
          const req = indexedDB.open("manu-jogos");
          req.onsuccess = () => {
            const tx = req.result.transaction("caca", "readwrite");
            tx.objectStore("caca").put({ id: "progresso", nivel: n, melhor: null, atualizadoEm: 1 });
            tx.oncomplete = () => {
              req.result.close();
              resolve();
            };
            tx.onerror = () => reject(tx.error);
          };
          req.onerror = () => reject(req.error);
        }),
      nivel,
    );
    await page.reload();
    await expect(page.locator("main")).toHaveAttribute("data-nivel", String(nivel));
    const instrucao = (await page.locator("[data-instrucao]").getAttribute("data-instrucao"))!;
    expect(instrucao.startsWith(nivel === 2 ? "multiplos-" : "fatores-")).toBe(true);
    await cacarRodada(page, 0);
  }
});

test("persistência: subir de nível sobrevive ao reload", async ({ page }) => {
  test.setTimeout(120000);
  await expect(page.locator("main")).toHaveAttribute("data-nivel", "1");
  for (let i = 0; i < 6; i++) await cacarRodada(page, i);
  await tocarNoElemento(page.getByLabel("mais difícil"));
  await expect(page.locator("main")).toHaveAttribute("data-nivel", "2");

  await page.reload();
  await expect(page.locator("main")).toHaveAttribute("data-nivel", "2", { timeout: 5000 });
});

test("três formatos: células >= 44px e dentro da tela", async ({ browser }) => {
  const formatos = [
    { nome: "celular 390", viewport: { width: 390, height: 844 } },
    { nome: "tablet 820", viewport: { width: 820, height: 1180 } },
    { nome: "desktop 1440", viewport: { width: 1440, height: 900 } },
  ];
  for (const formato of formatos) {
    const contexto = await browser.newContext({ viewport: formato.viewport });
    const pagina = await contexto.newPage();
    await pagina.goto("/caca");
    await expect(pagina.locator("[data-instrucao]")).toBeVisible();

    for (const alvo of await pagina.locator("[data-numero]").all()) {
      const caixa = await alvo.boundingBox();
      expect(caixa, `${formato.nome}: célula sem caixa`).not.toBeNull();
      const menor = Math.min(caixa!.width, caixa!.height);
      expect(menor, `${formato.nome}: célula pequena (${Math.round(menor)}px)`).toBeGreaterThanOrEqual(44);
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
