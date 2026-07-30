import { expect, test, type Browser, type Page } from "@playwright/test";
import { tocarNoElemento } from "./_toque";

/**
 * Foguete das Contas — SPEC §6.2: toque com dedo real, três formatos de tela,
 * fluxo feliz até o confete, erro que não destrói estado e persistência.
 */

/** Oráculo do teste: resolve a conta exibida no meteoro. */
function calcular(conta: string): number {
  const [a, op, b] = conta.split(" ");
  const x = Number(a);
  const y = Number(b);
  if (op === "+") return x + y;
  if (op === "−") return x - y;
  return x * y;
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

/** Acerta a conta atual tocando a bolha certa com dedo de verdade. */
async function acertarUma(page: Page) {
  const meteoro = page.locator("[data-conta]");
  await expect(meteoro).toBeVisible();
  const conta = await meteoro.getAttribute("data-conta");
  const resposta = calcular(conta!);
  const antes = Number(await page.locator("[data-acertos]").getAttribute("data-acertos"));
  await tocarNoElemento(page.getByLabel(`resposta ${resposta}`, { exact: true }));
  await expect(page.locator("[data-acertos]")).toHaveAttribute("data-acertos", String(antes + 1));
  // espera a próxima rodada spawnar (ou a fase completar)
  if (antes + 1 < 10) await expect(page.locator("[data-conta]")).toBeVisible({ timeout: 3000 });
}

test.beforeEach(async ({ page }) => {
  await page.goto("/contas");
  await limparBanco(page);
  await page.reload();
  await expect(page.locator("[data-conta]")).toBeVisible();
});

test("o hub leva ao Foguete das Contas em um toque", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Foguete das Contas").click();
  await expect(page).toHaveURL(/\/contas/);
  await expect(page.locator("[data-conta]")).toBeVisible();
});

test("fluxo feliz: 10 acertos, confete DE VERDADE e volta ao hub", async ({ page }) => {
  for (let i = 0; i < 10; i++) await acertarUma(page);

  // fase completa: partícula viva (data-ativo), não só canvas presente no DOM
  await expect(page.locator("canvas[data-ativo='true']")).toBeAttached();
  await expect(page.getByText("Você acertou tudo!")).toBeVisible();
  await expect(page.getByLabel("jogar de novo")).toBeVisible();
  await expect(page.getByLabel("mais difícil")).toBeVisible();

  await tocarNoElemento(page.getByLabel("voltar para os jogos"));
  await expect(page).toHaveURL(/\/$/);
});

test("resposta errada não avança, não troca a conta e não trava o jogo", async ({ page }) => {
  const conta = await page.locator("[data-conta]").getAttribute("data-conta");
  const resposta = calcular(conta!);
  const opcoes = page.locator("[aria-label^='resposta ']");
  await expect(opcoes).toHaveCount(4);

  // toca uma bolha ERRADA qualquer
  const rotulos = await opcoes.evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
  const errada = rotulos.find((r) => r !== `resposta ${resposta}`)!;
  await tocarNoElemento(page.getByLabel(errada, { exact: true }));

  await expect(page.locator("[data-acertos]")).toHaveAttribute("data-acertos", "0");
  await expect(page.locator("[data-conta]")).toHaveAttribute("data-conta", conta!);

  // e a certa continua funcionando depois do erro
  await acertarUma(page);
});

test("persistência: subir de nível sobrevive ao reload", async ({ page }) => {
  await expect(page.locator("main")).toHaveAttribute("data-nivel", "1");
  for (let i = 0; i < 10; i++) await acertarUma(page);
  await tocarNoElemento(page.getByLabel("mais difícil"));
  await expect(page.locator("main")).toHaveAttribute("data-nivel", "2");

  await page.reload();
  await expect(page.locator("main")).toHaveAttribute("data-nivel", "2");
  await expect(page.locator("[data-conta]")).toBeVisible();
});

test("três formatos: alvos de toque >= 72px em celular, tablet e desktop", async ({ browser }) => {
  const formatos = [
    { nome: "celular 390", viewport: { width: 390, height: 844 } },
    { nome: "tablet 820", viewport: { width: 820, height: 1180 } },
    { nome: "desktop 1440", viewport: { width: 1440, height: 900 } },
  ];
  for (const formato of formatos) {
    const contexto = await (browser as Browser).newContext({ viewport: formato.viewport });
    const pagina = await contexto.newPage();
    await pagina.goto("/contas");
    await expect(pagina.locator("[data-conta]")).toBeVisible();

    for (const alvo of await pagina.locator("[aria-label^='resposta ']").all()) {
      const caixa = await alvo.boundingBox();
      expect(caixa, `${formato.nome}: bolha sem caixa`).not.toBeNull();
      expect(caixa!.width, `${formato.nome}: bolha estreita demais`).toBeGreaterThanOrEqual(72);
      expect(caixa!.height, `${formato.nome}: bolha baixa demais`).toBeGreaterThanOrEqual(72);
    }
    const voltar = await pagina.getByLabel("voltar para os jogos").boundingBox();
    expect(voltar!.width, `${formato.nome}: voltar pequeno`).toBeGreaterThanOrEqual(56);
    await contexto.close();
  }
});
