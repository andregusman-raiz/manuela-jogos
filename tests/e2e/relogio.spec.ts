import { expect, test, type Page } from "@playwright/test";
import { tocarNoElemento } from "./_toque";

/**
 * Relógio Mágico — SPEC onda 2 §3.2. O anti-mutação central: o TESTE calcula
 * os graus a partir de data-hora (oráculo próprio) e confere o transform REAL
 * dos ponteiros — motor certo com SVG mentiroso falha aqui.
 */

function grausDe(rotulo: string): { hora: number; minuto: number } {
  const [h, m] = rotulo.split(":").map(Number);
  return { hora: (h % 12) * 30 + m * 0.5, minuto: m * 6 };
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

async function conferirPonteiros(page: Page) {
  const rotulo = (await page.locator("[data-hora]").getAttribute("data-hora"))!;
  const esperado = grausDe(rotulo);
  await expect(page.locator("[data-ponteiro='hora']")).toHaveAttribute(
    "transform",
    `rotate(${esperado.hora} 100 100)`,
  );
  await expect(page.locator("[data-ponteiro='minuto']")).toHaveAttribute(
    "transform",
    `rotate(${esperado.minuto} 100 100)`,
  );
  return rotulo;
}

async function acertarUma(page: Page, rodada: number) {
  const rotulo = await conferirPonteiros(page);
  await tocarNoElemento(page.getByLabel(`resposta ${rotulo}`, { exact: true }));
  await expect(page.locator("[data-acertos]")).toHaveAttribute(
    "data-acertos",
    String(rodada + 1),
    { timeout: 4000 },
  );
}

test.beforeEach(async ({ page }) => {
  await page.goto("/relogio");
  await limparBanco(page);
  await page.reload();
  await expect(page.locator("[data-hora]")).toBeVisible();
});

test("fluxo feliz: do card do hub aos 8 acertos, ponteiros honestos, confete", async ({
  page,
}) => {
  await page.goto("/");
  await tocarNoElemento(page.getByLabel("Relógio Mágico"));
  await expect(page).toHaveURL(/\/relogio/);
  await expect(page.locator("[data-hora]")).toBeVisible();

  for (let i = 0; i < 8; i++) await acertarUma(page, i);

  await expect(page.getByText("Que olho no relógio!")).toBeVisible();
  await expect(page.locator("canvas[data-ativo='true']")).toBeAttached();

  await tocarNoElemento(page.getByLabel("voltar para os jogos"));
  await expect(page).toHaveURL(/\/$/);
});

test("erro: shake, o relógio NÃO muda e a certa continua valendo", async ({ page }) => {
  const rotulo = (await page.locator("[data-hora]").getAttribute("data-hora"))!;
  const rotulos = await page
    .locator("[aria-label^='resposta ']")
    .evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
  const errada = rotulos.find((r) => r !== `resposta ${rotulo}`)!;

  await tocarNoElemento(page.getByLabel(errada, { exact: true }));
  // o shake é visível de verdade: a bolha errada remonta com anima-nao
  await expect(page.locator(`.anima-nao:has([aria-label="${errada}"])`)).toBeAttached();
  await expect(page.locator("[data-acertos]")).toHaveAttribute("data-acertos", "0");
  await expect(page.locator("[data-hora]")).toHaveAttribute("data-hora", rotulo);

  await acertarUma(page, 0);
});

test("persistência: subir de nível sobrevive ao reload", async ({ page }) => {
  await expect(page.locator("main")).toHaveAttribute("data-nivel", "1");
  for (let i = 0; i < 8; i++) await acertarUma(page, i);
  await tocarNoElemento(page.getByLabel("mais difícil"));
  await expect(page.locator("main")).toHaveAttribute("data-nivel", "2");

  await page.reload();
  await expect(page.locator("main")).toHaveAttribute("data-nivel", "2", { timeout: 5000 });
  await expect(page.locator("[data-hora]")).toBeVisible();
});

test("nível 3 sorteia minutos de 5 em 5 (via progresso salvo)", async ({ page }) => {
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const req = indexedDB.open("manu-jogos");
        req.onsuccess = () => {
          const tx = req.result.transaction("relogio", "readwrite");
          tx.objectStore("relogio").put({ id: "progresso", nivel: 3, melhor: null, atualizadoEm: 1 });
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
  const rotulo = await conferirPonteiros(page);
  const minuto = Number(rotulo.split(":")[1]);
  expect(minuto % 5).toBe(0);
  await acertarUma(page, 0);
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
    await pagina.goto("/relogio");
    await expect(pagina.locator("[data-hora]")).toBeVisible();

    for (const alvo of await pagina.locator("[aria-label^='resposta ']").all()) {
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
