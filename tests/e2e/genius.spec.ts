import { expect, test, type Page } from "@playwright/test";
import { tocarNoElemento } from "./_toque";

/**
 * Genius dos Sons — SPEC onda 2 §3.4. O teste lê a sequência de data-seq
 * (gancho explícito, mesma decisão do data-par da Memória), espera a vez de
 * ouvir e repete. Anti-mutação "Genius mudo": conta osciladores WebAudio
 * criados durante o replay — visual sem som falha.
 */

const CORES = ["rosa", "azul", "amarelo", "verde"];

async function limparBanco(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const req = indexedDB.deleteDatabase("manu-jogos");
        req.onsuccess = req.onerror = req.onblocked = () => resolve();
      }),
  );
}

async function esperarVez(page: Page) {
  await expect(page.locator("[data-fase-genius]")).toHaveAttribute("data-fase-genius", "ouvindo", {
    timeout: 10000,
  });
}

async function repetirRodada(page: Page, errarNoMeio = false) {
  await esperarVez(page);
  const seq = (await page.locator("[data-seq]").getAttribute("data-seq"))!.split(",").map(Number);
  const tamanho = Number(await page.locator("[data-tamanho]").getAttribute("data-tamanho"));

  if (errarNoMeio) {
    // acerta o 1º e erra NO MEIO (2º) — prova que o erro intermediário
    // reapresenta o MESMO prefixo do zero
    await tocarNoElemento(page.getByLabel(`botão ${CORES[seq[0]]}`, { exact: true }));
    const errado = (seq[1] + 1) % 4;
    await tocarNoElemento(page.getByLabel(`botão ${CORES[errado]}`, { exact: true }));
    await expect(page.locator("[data-fase-genius]")).toHaveAttribute(
      "data-fase-genius",
      "mostrando",
    );
    await expect(page.locator("[data-tamanho]")).toHaveAttribute("data-tamanho", String(tamanho));
    await esperarVez(page);
  }

  for (let i = 0; i < tamanho; i++) {
    await tocarNoElemento(page.getByLabel(`botão ${CORES[seq[i]]}`, { exact: true }));
  }
}

async function iniciar(page: Page) {
  await tocarNoElemento(page.getByLabel("começar a jogar", { exact: true }));
  await expect(page.locator("[data-seq]")).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.goto("/genius");
  await limparBanco(page);
  await page.reload();
  // a partida só nasce de um gesto (autoplay do WebAudio)
  await iniciar(page);
});

test("fluxo feliz: do card do hub à sequência de 8, com som DE VERDADE", async ({ page }) => {
  test.setTimeout(120000);
  // contador de osciladores instalado ANTES do app carregar
  await page.addInitScript(() => {
    const original = AudioContext.prototype.createOscillator;
    (window as unknown as { __osciladores: number }).__osciladores = 0;
    AudioContext.prototype.createOscillator = function (...args) {
      (window as unknown as { __osciladores: number }).__osciladores++;
      return original.apply(this, args as []);
    };
  });
  await page.goto("/").catch(() => page.goto("/"));
  await tocarNoElemento(page.getByLabel("Genius dos Sons"));
  await expect(page).toHaveURL(/\/genius/);
  await iniciar(page);

  // ISOLA o replay: zera o contador logo após o gesto de início (antes de
  // qualquer toque da criança) e mede quando a vez chega — só as notas do
  // replay podem ter tocado nesse intervalo
  await page.evaluate(() => {
    (window as unknown as { __osciladores: number }).__osciladores = 0;
  });
  await esperarVez(page);
  const osciladoresDoReplay = await page.evaluate(
    () => (window as unknown as { __osciladores: number }).__osciladores,
  );
  expect(osciladoresDoReplay, "replay mudo: nenhuma nota tocada").toBeGreaterThanOrEqual(2);

  // rodadas 2..8
  for (let rodada = 2; rodada <= 8; rodada++) {
    await repetirRodada(page);
  }

  await expect(page.getByText("Que memória! 8 sons seguidos!")).toBeVisible({ timeout: 15000 });
  await expect(page.locator("canvas[data-ativo='true']")).toBeAttached();
});

test("erro: replay do MESMO prefixo, nunca encolhe, e ainda dá para completar a rodada", async ({
  page,
}) => {
  await repetirRodada(page, true);
  // completou a rodada 2 mesmo depois do erro → cresceu para 3
  await expect(page.locator("[data-tamanho]")).toHaveAttribute("data-tamanho", "3", {
    timeout: 5000,
  });
});

test("toque durante o replay é ignorado", async ({ page }) => {
  // ainda em "mostrando": tocar não muda nada
  await expect(page.locator("[data-fase-genius]")).toHaveAttribute("data-fase-genius", "mostrando");
  await tocarNoElemento(page.getByLabel("botão rosa", { exact: true }));
  await expect(page.locator("[data-tamanho]")).toHaveAttribute("data-tamanho", "2");
  await expect(page.locator("[data-fase-genius]")).not.toHaveAttribute(
    "data-fase-genius",
    "ouvindo",
  );
});

test("persistência: o recorde sobrevive ao reload", async ({ page }) => {
  await repetirRodada(page); // repetiu 2 → recorde 2
  await expect(page.locator("main")).toHaveAttribute("data-nivel", "2", { timeout: 5000 });
  await page.reload();
  await expect(page.locator("main")).toHaveAttribute("data-nivel", "2", { timeout: 5000 });
});

test("três formatos: quadrantes >= 120px e dentro da tela", async ({ browser }) => {
  const formatos = [
    { nome: "celular 390", viewport: { width: 390, height: 844 } },
    { nome: "tablet 820", viewport: { width: 820, height: 1180 } },
    { nome: "desktop 1440", viewport: { width: 1440, height: 900 } },
  ];
  for (const formato of formatos) {
    const contexto = await browser.newContext({ viewport: formato.viewport });
    const pagina = await contexto.newPage();
    await pagina.goto("/genius");
    await tocarNoElemento(pagina.getByLabel("começar a jogar", { exact: true }));
    await expect(pagina.locator("[data-seq]")).toBeVisible();

    for (const cor of CORES) {
      const caixa = await pagina.getByLabel(`botão ${cor}`, { exact: true }).boundingBox();
      expect(caixa, `${formato.nome}: ${cor} sem caixa`).not.toBeNull();
      expect(caixa!.width, `${formato.nome}: ${cor} estreito`).toBeGreaterThanOrEqual(120);
      expect(caixa!.height, `${formato.nome}: ${cor} baixo`).toBeGreaterThanOrEqual(120);
      expect(caixa!.x, `${formato.nome}: ${cor} fora à esquerda`).toBeGreaterThanOrEqual(0);
      expect(caixa!.x + caixa!.width, `${formato.nome}: ${cor} vaza à direita`).toBeLessThanOrEqual(
        formato.viewport.width,
      );
      expect(caixa!.y + caixa!.height, `${formato.nome}: ${cor} vaza abaixo`).toBeLessThanOrEqual(
        formato.viewport.height,
      );
    }
    await contexto.close();
  }
});
