import { expect, test, type Page } from "@playwright/test";
import { tocarNoElemento } from "./_toque";

/**
 * Lojinha da Manu — SPEC onda 2 §3.3. O teste acha a combinação de peças por
 * DP própria (oráculo independente) e paga exato; estourar não adiciona peça.
 */

const ROTULO: Record<number, string> = {
  25: "moeda de 25 centavos",
  50: "moeda de 50 centavos",
  100: "moeda de 1 real",
  200: "nota de 2 reais",
  500: "nota de 5 reais",
  1000: "nota de 10 reais",
  2000: "nota de 20 reais",
};

function formatar(centavos: number): string {
  const reais = Math.floor(centavos / 100);
  const resto = centavos % 100;
  return resto === 0 ? `R$ ${reais}` : `R$ ${reais},${String(resto).padStart(2, "0")}`;
}

/** DP com reconstrução: quais peças somam exatamente o preço. */
function combinar(preco: number, pecas: number[]): number[] {
  const de = new Array<number>(preco + 1).fill(-1);
  de[0] = 0;
  for (let v = 1; v <= preco; v++) {
    for (const p of pecas) if (p <= v && de[v - p] >= 0) de[v] = p;
  }
  if (de[preco] < 0) throw new Error(`preço impagável no teste: ${preco}`);
  const usadas: number[] = [];
  for (let v = preco; v > 0; v -= de[v]) usadas.push(de[v]);
  return usadas;
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

async function comprarUma(page: Page, rodada: number, pecasDoNivel: number[]) {
  const preco = Number(await page.locator("[data-preco]").getAttribute("data-preco"));
  for (const valor of combinar(preco, pecasDoNivel)) {
    await tocarNoElemento(page.getByLabel(ROTULO[valor], { exact: true }));
  }
  await expect(page.locator("[data-soma]")).toHaveAttribute("data-soma", String(preco));
  await tocarNoElemento(page.getByLabel("pagar", { exact: true }));
  await expect(page.locator("[data-acertos]")).toHaveAttribute(
    "data-acertos",
    String(rodada + 1),
    { timeout: 4000 },
  );
  await page.waitForTimeout(1000);
}

const NOTAS = [200, 500, 1000, 2000];

test.beforeEach(async ({ page }) => {
  await page.goto("/lojinha");
  await limparBanco(page);
  await page.reload();
  await expect(page.locator("[data-preco]")).toBeVisible();
});

test("fluxo feliz: do card do hub às 8 compras pagas exatas, confete", async ({ page }) => {
  await page.goto("/");
  await tocarNoElemento(page.getByLabel("Lojinha da Manu"));
  await expect(page).toHaveURL(/\/lojinha/);
  await expect(page.locator("[data-preco]")).toBeVisible();

  for (let i = 0; i < 8; i++) await comprarUma(page, i, NOTAS);

  await expect(page.getByText("Loja fechada, tudo vendido!")).toBeVisible();
  await expect(page.locator("canvas[data-ativo='true']")).toBeAttached();

  await tocarNoElemento(page.getByLabel("voltar para os jogos"));
  await expect(page).toHaveURL(/\/$/);
});

test("estourar o preço: a peça volta sozinha e o visor treme", async ({ page }) => {
  const preco = Number(await page.locator("[data-preco]").getAttribute("data-preco"));
  // enche até a nota de 20 não caber mais
  let soma = 0;
  while (soma + 2000 <= preco) {
    await tocarNoElemento(page.getByLabel("nota de 20 reais", { exact: true }));
    soma += 2000;
  }
  await expect(page.locator("[data-soma]")).toHaveAttribute("data-soma", String(soma));
  // esta estoura: NÃO entra
  await tocarNoElemento(page.getByLabel("nota de 20 reais", { exact: true }));
  await expect(page.locator("[data-soma]")).toHaveAttribute("data-soma", String(soma));
  await expect(page.locator(".anima-nao[data-soma]")).toBeAttached();
});

test("devolver: tocar a peça no visor tira ela da soma", async ({ page }) => {
  await tocarNoElemento(page.getByLabel("nota de 2 reais", { exact: true }));
  await expect(page.locator("[data-soma]")).toHaveAttribute("data-soma", "200");
  await tocarNoElemento(page.getByLabel("devolver nota de 2 reais", { exact: true }));
  await expect(page.locator("[data-soma]")).toHaveAttribute("data-soma", "0");
});

test("persistência: subir de nível sobrevive ao reload", async ({ page }) => {
  await expect(page.locator("main")).toHaveAttribute("data-nivel", "1");
  for (let i = 0; i < 8; i++) await comprarUma(page, i, NOTAS);
  await tocarNoElemento(page.getByLabel("mais difícil"));
  await expect(page.locator("main")).toHaveAttribute("data-nivel", "2");

  await page.reload();
  await expect(page.locator("main")).toHaveAttribute("data-nivel", "2", { timeout: 5000 });
});

test("nível 3: o troco certo é pagamento − preço (via progresso salvo)", async ({ page }) => {
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const req = indexedDB.open("manu-jogos");
        req.onsuccess = () => {
          const tx = req.result.transaction("lojinha", "readwrite");
          tx.objectStore("lojinha").put({ id: "progresso", nivel: 3, melhor: null, atualizadoEm: 1 });
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

  // o reload do controllerchange do SW pode destruir o contexto no meio —
  // RETRY em vez de tempo arbitrário (padrão do contas.spec)
  let preco = 0;
  let pagamento = 0;
  let rotulos: (string | null)[] = [];
  await expect(async () => {
    await expect(page.locator("[data-preco]")).toBeVisible();
    preco = Number(await page.locator("[data-preco]").getAttribute("data-preco"));
    pagamento = Number(await page.locator("[data-preco]").getAttribute("data-pagamento"));
    rotulos = await page
      .locator("[aria-label^='troco ']")
      .evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
  }).toPass({ timeout: 10000 });
  expect(pagamento).toBeGreaterThan(preco);
  // erra de propósito primeiro (uma opção != certa)
  const certa = `troco ${formatar(pagamento - preco)}`;
  const errada = rotulos.find((r) => r !== certa)!;
  await tocarNoElemento(page.getByLabel(errada, { exact: true }));
  await expect(page.locator("[data-acertos]")).toHaveAttribute("data-acertos", "0");

  await tocarNoElemento(page.getByLabel(certa, { exact: true }));
  await expect(page.locator("[data-acertos]")).toHaveAttribute("data-acertos", "1");
});

test("três formatos: peças >= 72px e dentro da tela", async ({ browser }) => {
  const formatos = [
    { nome: "celular 390", viewport: { width: 390, height: 844 } },
    { nome: "tablet 820", viewport: { width: 820, height: 1180 } },
    { nome: "desktop 1440", viewport: { width: 1440, height: 900 } },
  ];
  for (const formato of formatos) {
    const contexto = await browser.newContext({ viewport: formato.viewport });
    const pagina = await contexto.newPage();
    await pagina.goto("/lojinha");
    await expect(pagina.locator("[data-preco]")).toBeVisible();

    for (const alvo of await pagina.locator("[aria-label^='nota de '], [aria-label^='moeda de ']").all()) {
      const caixa = await alvo.boundingBox();
      expect(caixa, `${formato.nome}: peça sem caixa`).not.toBeNull();
      expect(caixa!.width, `${formato.nome}: peça estreita`).toBeGreaterThanOrEqual(72);
      expect(caixa!.height, `${formato.nome}: peça baixa`).toBeGreaterThanOrEqual(72);
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
