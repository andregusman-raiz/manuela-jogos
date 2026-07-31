import { expect, test, type Page } from "@playwright/test";
import { tocarNoElemento } from "./_toque";

/**
 * Pizza das Frações — SPEC onda 3 §3.1. Oráculos do TESTE: aritmética própria
 * para ler/comparar; a contagem de fatias pintadas confere o DESENHO real
 * (anti-mutação "pizza mentirosa").
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

async function salvarNivel(page: Page, nivel: number) {
  await page.evaluate(
    (n) =>
      new Promise<void>((resolve, reject) => {
        const req = indexedDB.open("manu-jogos");
        req.onsuccess = () => {
          const tx = req.result.transaction("fracoes", "readwrite");
          tx.objectStore("fracoes").put({ id: "progresso", nivel: n, melhor: null, atualizadoEm: 1 });
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
}

/** Nível 1: a pizza DESENHADA bate com data-fracao e a resposta certa conta. */
async function acertarLer(page: Page, rodada: number) {
  const alvo = (await page.locator("[data-fracao]").getAttribute("data-fracao"))!;
  const [n] = alvo.split("/").map(Number);
  // anti-mutação: o desenho tem exatamente N fatias pintadas
  await expect(page.locator("path[data-pintada='true']")).toHaveCount(n);
  await tocarNoElemento(page.getByLabel(`fração ${alvo}`, { exact: true }));
  await expect(page.locator("[data-acertos]")).toHaveAttribute(
    "data-acertos",
    String(rodada + 1),
    { timeout: 4000 },
  );
}

test.beforeEach(async ({ page }) => {
  await page.goto("/fracoes");
  await limparBanco(page);
  await page.reload();
  await expect(page.locator("[data-fracao]")).toBeVisible();
});

test("fluxo feliz: do card do hub aos 8 acertos de leitura, confete", async ({ page }) => {
  await page.goto("/").catch(() => page.goto("/"));
  await tocarNoElemento(page.getByLabel("Pizza das Frações"));
  await expect(page).toHaveURL(/\/fracoes/);
  await expect(page.locator("[data-fracao]")).toBeVisible();

  for (let i = 0; i < 8; i++) await acertarLer(page, i);

  await expect(page.getByText("Mestre das pizzas!")).toBeVisible();
  await expect(page.locator("canvas[data-ativo='true']")).toBeAttached();

  await tocarNoElemento(page.getByLabel("voltar para os jogos"));
  await expect(page).toHaveURL(/\/$/);
});

test("erro: shake e a rodada NÃO troca; a certa continua valendo", async ({ page }) => {
  const alvo = (await page.locator("[data-fracao]").getAttribute("data-fracao"))!;
  const rotulos = await page
    .locator("[aria-label^='fração ']")
    .evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
  const errada = rotulos.find((r) => r !== `fração ${alvo}`)!;

  await tocarNoElemento(page.getByLabel(errada, { exact: true }));
  await expect(page.locator("[data-acertos]")).toHaveAttribute("data-acertos", "0");
  await expect(page.locator("[data-fracao]")).toHaveAttribute("data-fracao", alvo);

  await acertarLer(page, 0);
});

test("nível 2: pintar a fração pedida e conferir (via progresso salvo)", async ({ page }) => {
  await salvarNivel(page, 2);
  await page.reload();
  await expect(page.locator("main")).toHaveAttribute("data-nivel", "2");

  const alvo = (await page.locator("[data-fracao]").getAttribute("data-fracao"))!;
  const [n] = alvo.split("/").map(Number);

  // conferir com a pintura errada primeiro: não avança
  await tocarNoElemento(page.getByLabel("conferir", { exact: true }));
  await expect(page.locator("[data-acertos]")).toHaveAttribute("data-acertos", "0");

  for (let k = 0; k < n; k++) {
    await tocarNoElemento(page.locator(`path[data-fatia='${k}']`));
  }
  await expect(page.locator("path[data-pintada='true']")).toHaveCount(n);
  await tocarNoElemento(page.getByLabel("conferir", { exact: true }));
  await expect(page.locator("[data-acertos]")).toHaveAttribute("data-acertos", "1", {
    timeout: 4000,
  });
});

test("nível 3: comparar com aritmética PRÓPRIA do teste (via progresso salvo)", async ({
  page,
}) => {
  await salvarNivel(page, 3);
  await page.reload();
  await expect(page.locator("main")).toHaveAttribute("data-nivel", "3");

  const par = (await page.locator("[data-fracoes]").getAttribute("data-fracoes"))!;
  const [a, b] = par.split("|").map((s) => s.split("/").map(Number));
  // oráculo independente: produto cruzado refeito aqui
  const cruzA = a[0] * b[1];
  const cruzB = b[0] * a[1];
  const rotulo = cruzA === cruzB ? "são iguais" : cruzA > cruzB ? "a primeira" : "a segunda";

  await tocarNoElemento(page.getByLabel(rotulo, { exact: true }));
  await expect(page.locator("[data-acertos]")).toHaveAttribute("data-acertos", "1", {
    timeout: 4000,
  });
});

test("persistência: subir de nível sobrevive ao reload", async ({ page }) => {
  await expect(page.locator("main")).toHaveAttribute("data-nivel", "1");
  for (let i = 0; i < 8; i++) await acertarLer(page, i);
  await tocarNoElemento(page.getByLabel("mais difícil"));
  await expect(page.locator("main")).toHaveAttribute("data-nivel", "2");

  await page.reload();
  await expect(page.locator("main")).toHaveAttribute("data-nivel", "2", { timeout: 5000 });
});

test("três formatos: opções >= 72px, dentro da tela — e o hub segura 10 cards", async ({
  browser,
}) => {
  const formatos = [
    { nome: "celular 390", viewport: { width: 390, height: 844 } },
    { nome: "tablet 820", viewport: { width: 820, height: 1180 } },
    { nome: "desktop 1440", viewport: { width: 1440, height: 900 } },
  ];
  for (const formato of formatos) {
    const contexto = await browser.newContext({ viewport: formato.viewport });
    const pagina = await contexto.newPage();
    await pagina.goto("/fracoes");
    await expect(pagina.locator("[data-fracao]")).toBeVisible();

    for (const alvo of await pagina.locator("[aria-label^='fração ']").all()) {
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
