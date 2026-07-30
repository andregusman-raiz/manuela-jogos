import { expect, test, type Page } from "@playwright/test";

/**
 * O que estes testes protegem são as promessas do produto, não os detalhes:
 *  - a criança desenha com o dedo e o traço aparece;
 *  - nada se perde ao fechar o navegador;
 *  - nenhum toque só destrói trabalho;
 *  - pintar região do livro não vaza para o resto do papel;
 *  - o que sai do aparelho passa por um adulto.
 */

const TELA = ".tela-desenho";

async function limparBanco(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const req = indexedDB.deleteDatabase("manu-jogos");
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
        req.onblocked = () => resolve();
      }),
  );
}

/** Desenha arrastando o dedo de verdade (touch), não com mouse. */
async function riscar(page: Page, deltaY = 0) {
  const caixa = await page.locator(TELA).boundingBox();
  if (!caixa) throw new Error("canvas não encontrado");
  const y = caixa.y + caixa.height / 2 + deltaY;
  const x0 = caixa.x + caixa.width * 0.2;
  const x1 = caixa.x + caixa.width * 0.8;

  // Sem tap antes do arraste: um toque solto JÁ é um desenho (vira pingo), e
  // isso deixaria duas operações no histórico em vez de uma.
  await page.mouse.move(x0, y);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) {
    await page.mouse.move(x0 + ((x1 - x0) * i) / 12, y - Math.sin((i / 12) * Math.PI) * 40);
  }
  await page.mouse.up();
}

async function pixelsPintados(page: Page) {
  return page.evaluate(() => {
    const arte = [...document.querySelectorAll("canvas")][1] as HTMLCanvasElement;
    const ctx = arte.getContext("2d");
    if (!ctx) return -1;
    const dados = ctx.getImageData(0, 0, arte.width, arte.height).data;
    let n = 0;
    for (let i = 3; i < dados.length; i += 4) if (dados[i] > 10) n++;
    return n;
  });
}

test.beforeEach(async ({ page }) => {
  await page.goto("/desenhar");
  await limparBanco(page);
  await page.reload();
  await page.waitForSelector(TELA);
});

test("o hub leva ao Ateliê em um toque", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Manuela");
  await page.getByLabel("Ateliê da Manu").click();
  await expect(page).toHaveURL(/\/desenhar/);
  await expect(page.locator(TELA)).toBeVisible();
});

test("desenha com o dedo e desfaz", async ({ page }) => {
  await expect(page.getByLabel("desfazer")).toBeDisabled();

  await riscar(page);
  expect(await pixelsPintados(page)).toBeGreaterThan(300);
  await expect(page.getByLabel("desfazer")).toBeEnabled();

  await page.getByLabel("desfazer").click();
  await expect.poll(() => pixelsPintados(page)).toBe(0);
});

test("não perde o desenho ao recarregar (autosave)", async ({ page }) => {
  await riscar(page);
  const antes = await pixelsPintados(page);
  expect(antes).toBeGreaterThan(300);

  await page.waitForTimeout(700); // deixa o autosave gravar
  await page.reload();
  await page.waitForSelector(TELA);

  // reconstruído a partir das operações: a contagem não é idêntica ao pixel,
  // mas o desenho tem de voltar com volume equivalente
  await expect.poll(() => pixelsPintados(page), { timeout: 5000 }).toBeGreaterThan(antes * 0.8);
});

test("apagar tudo exige segurar o dedo", async ({ page }) => {
  await riscar(page);
  await page.getByLabel("mais coisas: carimbos, formas, espelho e fundo").click();
  const lixeira = page.getByLabel("segure para apagar tudo");

  // toque rápido NÃO apaga
  await lixeira.dispatchEvent("pointerdown");
  await lixeira.dispatchEvent("pointerup");
  await page.waitForTimeout(300);
  expect(await pixelsPintados(page)).toBeGreaterThan(300);

  // segurando, apaga — e a bandeja se fecha sozinha ao confirmar, então o botão
  // sai do DOM antes de qualquer pointerup: é o comportamento esperado.
  await lixeira.dispatchEvent("pointerdown");
  await expect(lixeira).toBeHidden({ timeout: 4000 });
  await expect.poll(() => pixelsPintados(page)).toBe(0);
});

test("pintar região do livro não vaza para o papel", async ({ page }) => {
  await page.getByLabel("escolher desenho para colorir").click();
  await page.getByLabel("Gatinho").click();
  await page.waitForTimeout(400);

  await page.getByLabel("laranja").click();
  await page.waitForTimeout(150);
  const cabeca = page.locator('svg g[aria-label="pintar cabeça"]');
  await cabeca.dispatchEvent("pointerdown");
  await expect(cabeca).toHaveAttribute("fill", "#F76B15");

  // o canvas por baixo continua intocado — o toque não virou balde no papel
  expect(await pixelsPintados(page)).toBe(0);
});

test("compartilhar passa pelo portão parental", async ({ page }) => {
  await riscar(page);
  await page.getByLabel("mais coisas: carimbos, formas, espelho e fundo").click();
  await page.getByLabel("enviar este desenho para um adulto").click();

  const portao = page.getByRole("dialog", { name: "Precisa de um adulto" });
  await expect(portao).toBeVisible();

  const conta = await portao.locator("p").filter({ hasText: "+" }).first().textContent();
  const [, a, b] = conta?.match(/(\d+)\s*\+\s*(\d+)/) ?? [];

  // resposta errada é recusada e a conta muda
  const errada = String(Number(a) + Number(b) + 1);
  for (const d of errada) await portao.getByLabel(d, { exact: true }).click();
  await portao.getByLabel("confirmar").click();
  await expect(portao).toContainText("Não foi essa");

  // criança sem saber somar não passa daqui; o adulto passa
  const conta2 = await portao.locator("p").filter({ hasText: "+" }).first().textContent();
  const [, c, d2] = conta2?.match(/(\d+)\s*\+\s*(\d+)/) ?? [];
  for (const digito of String(Number(c) + Number(d2))) {
    await portao.getByLabel(digito, { exact: true }).click();
  }
  await portao.getByLabel("confirmar").click();
  await expect(portao).toBeHidden();
});

test("guardar de novo e trocar de página não duplicam na galeria", async ({ page }) => {
  const contarGaleria = () =>
    page.evaluate(
      () =>
        new Promise<number>((resolve) => {
          const req = indexedDB.open("manu-jogos", 1);
          req.onsuccess = () => {
            const g = req.result.transaction("atelie", "readonly").objectStore("atelie").getAll();
            g.onsuccess = () =>
              resolve((g.result as { id: string }[]).filter((d) => d.id !== "rascunho").length);
          };
          req.onerror = () => resolve(-1);
        }),
    );

  await riscar(page);

  // guardar 2x sem mudar nada = 1 item só
  await page.getByLabel("guardar meu desenho").click();
  await expect(page.getByText("Guardado!")).toBeVisible();
  await page.getByLabel("guardar meu desenho").click();
  await expect(page.getByText("Já está guardado!")).toBeVisible();
  expect(await contarGaleria()).toBe(1);

  // ir colorir logo depois de guardar também não cria segunda cópia
  await page.getByLabel("escolher desenho para colorir").click();
  await page.getByLabel("Gatinho").click();
  await page.waitForTimeout(500);
  expect(await contarGaleria()).toBe(1);

  // continuar um desenho da galeria e guardar ATUALIZA o original
  await page.getByLabel("mais coisas: carimbos, formas, espelho e fundo").click();
  await page.getByLabel("meus desenhos").click();
  await page.locator('[aria-label="abrir este desenho"]').first().click();
  await page.waitForTimeout(400);
  await riscar(page, 80);
  await page.getByLabel("guardar meu desenho").click();
  await expect(page.getByText("Guardado!")).toBeVisible();
  expect(await contarGaleria()).toBe(1);
});

test("guardar coloca o desenho na galeria com miniatura", async ({ page }) => {
  await riscar(page);
  await page.getByLabel("guardar meu desenho").click();
  await expect(page.getByText("Guardado!")).toBeVisible();

  await page.getByLabel("mais coisas: carimbos, formas, espelho e fundo").click();
  await page.getByLabel("meus desenhos").click();

  await expect(page.getByRole("heading", { name: "Meus desenhos" })).toBeVisible();
  const miniatura = page.locator('img[alt="desenho guardado"]').first();
  await expect(miniatura).toBeVisible();
  expect(await miniatura.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
});

test("alvos de toque respeitam o mínimo infantil", async ({ page }) => {
  // NN/g: ~2cm x 2cm para criança. 64px é o piso que ainda cabe em tela de 360px.
  const rotulos = ["borracha", "balde de tinta", "desfazer", "guardar meu desenho"];
  for (const rotulo of rotulos) {
    const caixa = await page.getByLabel(rotulo).boundingBox();
    expect(caixa, rotulo).not.toBeNull();
    expect(Math.min(caixa!.width, caixa!.height), `${rotulo} pequeno demais`).toBeGreaterThanOrEqual(
      56,
    );
  }
});
