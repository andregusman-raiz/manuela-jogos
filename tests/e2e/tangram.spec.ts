import { expect, test, type Page } from "@playwright/test";
import { tocarNoElemento } from "./_toque";

/**
 * Tangram da Manu — SPEC onda 3 §3.3. O arrasto converte os alvos LÓGICOS
 * (data-alvo-*) para pixels de tela via bbox do svg × (alvo/200) — a mesma
 * conversão (inversa) que o componente faz com getScreenCTM.
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

async function encaixar(page: Page, peca: string) {
  const el = page.locator(`[data-peca='${peca}']`);
  const alvoX = Number(await el.getAttribute("data-alvo-x"));
  const alvoY = Number(await el.getAttribute("data-alvo-y"));
  const alvoRot = Number(await el.getAttribute("data-alvo-rot"));

  // conversão lógico→tela com LETTERBOX (preserveAspectRatio centra o desenho:
  // o lado útil é o MENOR do box CSS e o resto é faixa vazia)
  const svg = (await page.locator("svg[aria-label^='silhueta']").boundingBox())!;
  const lado = Math.min(svg.width, svg.height);
  const origemX = svg.x + (svg.width - lado) / 2;
  const origemY = svg.y + (svg.height - lado) / 2;
  const escala = lado / 200;

  // ponto de agarre = CENTROIDE real (média dos vértices de `points`) — o
  // centro do bbox de um triângulo cai na hipotenusa e o WebKit resolvia o
  // hit para fora da peça; a média dos vértices está sempre dentro
  const agarre = async () => {
    const pts = (await el.getAttribute("points"))!
      .split(" ")
      .map((par) => par.split(",").map(Number));
    const cx = pts.reduce((s, [x]) => s + x, 0) / pts.length;
    const cy = pts.reduce((s, [, y]) => s + y, 0) / pts.length;
    return [origemX + cx * escala, origemY + cy * escala] as const;
  };

  // seleciona (down+up sem mover) e gira até a rotação do alvo
  const [sx, sy] = await agarre();
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  await page.mouse.up();
  const giros = (((alvoRot % 360) + 360) % 360) / 45;
  for (let i = 0; i < giros; i++) {
    await tocarNoElemento(page.getByLabel("girar a peça", { exact: true }));
  }

  // arrasta do centroide atual até o ponto-tela do alvo lógico
  const [ax, ay] = await agarre();
  await page.mouse.move(ax, ay);
  await page.mouse.down();
  await page.mouse.move(origemX + alvoX * escala, origemY + alvoY * escala, { steps: 8 });
  await page.mouse.up();
  // a ÚLTIMA peça completa a silhueta e o svg desmonta — sumir também é sucesso
  await expect(async () => {
    if ((await el.count()) === 0) return;
    expect(await el.getAttribute("data-encaixada"), `peça ${peca} não encaixou`).toBe("true");
  }).toPass({ timeout: 3000 });
}

const PECAS = ["g1", "g2", "m", "p1", "p2", "q", "para"];

test.beforeEach(async ({ page }) => {
  await page.goto("/tangram");
  await limparBanco(page);
  await page.reload();
  await expect(page.locator("[data-peca='q']")).toBeVisible();
});

test("fluxo feliz: montar a casa inteira arrastando, confete e volta", async ({ page }) => {
  test.setTimeout(90000);
  await page.goto("/").catch(() => page.goto("/"));
  await tocarNoElemento(page.getByLabel("Tangram da Manu"));
  await expect(page).toHaveURL(/\/tangram/);
  await expect(page.locator("main")).toHaveAttribute("data-silhueta", "casa");

  for (const peca of PECAS) await encaixar(page, peca);

  await expect(page.locator("[data-encaixadas]")).toHaveAttribute("data-encaixadas", "7");
  await expect(page.getByText("Você montou: casa!")).toBeVisible();
  await expect(page.locator("canvas[data-ativo='true']")).toBeAttached();

  await tocarNoElemento(page.getByLabel("voltar para os jogos"));
  await expect(page).toHaveURL(/\/$/);
});

test("soltar longe do alvo NÃO encaixa; peça continua arrastável", async ({ page }) => {
  const el = page.locator("[data-peca='q']");
  const caixa = (await el.boundingBox())!;
  await page.mouse.move(caixa.x + caixa.width / 2, caixa.y + caixa.height / 2);
  await page.mouse.down();
  await page.mouse.move(caixa.x + 120, caixa.y - 120, { steps: 5 });
  await page.mouse.up();
  await expect(el).toHaveAttribute("data-encaixada", "false");
  // e depois encaixa normalmente
  await encaixar(page, "q");
});

test("persistência: a próxima silhueta sobrevive ao reload", async ({ page }) => {
  test.setTimeout(90000);
  for (const peca of PECAS) await encaixar(page, peca);
  await tocarNoElemento(page.getByLabel("próxima silhueta"));
  await expect(page.locator("main")).toHaveAttribute("data-silhueta", "gato");

  await page.reload();
  await expect(page.locator("main")).toHaveAttribute("data-silhueta", "gato", { timeout: 5000 });
});

test("três formatos: peças com alvo tocável e dentro da tela", async ({ browser }) => {
  const formatos = [
    { nome: "celular 390", viewport: { width: 390, height: 844 } },
    { nome: "tablet 820", viewport: { width: 820, height: 1180 } },
    { nome: "desktop 1440", viewport: { width: 1440, height: 900 } },
  ];
  for (const formato of formatos) {
    const contexto = await browser.newContext({ viewport: formato.viewport });
    const pagina = await contexto.newPage();
    await pagina.goto("/tangram");
    await expect(pagina.locator("[data-peca='q']")).toBeVisible();

    for (const peca of PECAS) {
      const caixa = await pagina.locator(`[data-peca='${peca}']`).boundingBox();
      expect(caixa, `${formato.nome}: ${peca} sem caixa`).not.toBeNull();
      // peças do tangram são menores que o piso geral por natureza (exceção
      // documentada na SPEC); o paralelogramo tem 15.6 lógicos de altura —
      // piso realista da MENOR dimensão: 26px (o arrasto real é provado no
      // fluxo feliz)
      const menor = Math.min(caixa!.width, caixa!.height);
      expect(menor, `${formato.nome}: ${peca} pequena (${Math.round(menor)}px)`).toBeGreaterThanOrEqual(26);
      expect(caixa!.x, `${formato.nome}: ${peca} fora à esquerda`).toBeGreaterThanOrEqual(0);
      expect(caixa!.y, `${formato.nome}: ${peca} acima da tela`).toBeGreaterThanOrEqual(0);
      expect(caixa!.x + caixa!.width, `${formato.nome}: ${peca} vaza à direita`).toBeLessThanOrEqual(
        formato.viewport.width,
      );
      expect(
        caixa!.y + caixa!.height,
        `${formato.nome}: ${peca} vaza abaixo`,
      ).toBeLessThanOrEqual(formato.viewport.height);
    }
    await contexto.close();
  }
});
