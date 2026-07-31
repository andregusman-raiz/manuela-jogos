import { expect, test, type Page } from "@playwright/test";
import { ESTADOS } from "@/lib/estados/mapa";
import { gerarFase, perguntaAtual } from "@/lib/estados/motor";
import { tocarNoElemento } from "./_toque";

/**
 * Estados do Brasil — SPEC onda 3 §3.2. Acerto guiado por data-uf-pedida;
 * scaffold no 2º erro (evento do MOTOR); pinos escolares com alvo >= 24px.
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

/** Alvo tocável da UF: o pino quando existe (desenhado por cima), senão o path. */
function alvoDe(page: Page, uf: string) {
  return page.locator(`[data-uf='${uf}']`).last();
}

async function acertarUma(page: Page, rodada: number) {
  const pedida = (await page.locator("[data-uf-pedida]").getAttribute("data-uf-pedida"))!;
  await tocarNoElemento(alvoDe(page, pedida));
  await expect(page.locator("[data-acertos]")).toHaveAttribute(
    "data-acertos",
    String(rodada + 1),
    { timeout: 4000 },
  );
}

test.beforeEach(async ({ page }) => {
  await page.goto("/estados");
  await limparBanco(page);
  await page.reload();
  await expect(page.locator("[data-uf-pedida]")).toBeVisible();
});

test("fluxo feliz: do card do hub aos 8 estados achados, confete", async ({ page }) => {
  await page.goto("/").catch(() => page.goto("/"));
  await tocarNoElemento(page.getByLabel("Estados do Brasil"));
  await expect(page).toHaveURL(/\/estados/);
  await expect(page.locator("[data-uf-pedida]")).toBeVisible();

  for (let i = 0; i < 8; i++) await acertarUma(page, i);

  await expect(page.getByText("Que viajante!")).toBeVisible();
  await expect(page.locator("canvas[data-ativo='true']")).toBeAttached();

  await tocarNoElemento(page.getByLabel("voltar para os jogos"));
  await expect(page).toHaveURL(/\/$/);
});

test("2 erros na mesma pergunta acendem o scaffold no estado CERTO", async ({ page }) => {
  const pedida = (await page.locator("[data-uf-pedida]").getAttribute("data-uf-pedida"))!;
  const errada = pedida === "BA" ? "AM" : "BA";

  await tocarNoElemento(alvoDe(page, errada));
  await expect(page.locator(`[data-uf='${pedida}'][data-scaffold='true']`)).toHaveCount(0);
  await tocarNoElemento(alvoDe(page, errada));
  // scaffold: o CERTO pisca (evento do motor, nunca da pergunta seguinte)
  await expect(page.locator(`[data-uf='${pedida}'][data-scaffold='true']`).first()).toBeAttached();

  // tocar o certo depois do scaffold conta acerto normal
  await tocarNoElemento(alvoDe(page, pedida));
  await expect(page.locator("[data-acertos]")).toHaveAttribute("data-acertos", "1");
  await expect(page.locator("[data-scaffold='true']")).toHaveCount(0);
});

test("níveis 2 e 3 perguntam por capital e sigla (via progresso salvo)", async ({ page }) => {
  for (const nivel of [2, 3]) {
    await page.evaluate(
      (n) =>
        new Promise<void>((resolve, reject) => {
          const req = indexedDB.open("manu-jogos");
          req.onsuccess = () => {
            const tx = req.result.transaction("estados", "readwrite");
            tx.objectStore("estados").put({ id: "progresso", nivel: n, melhor: null, atualizadoEm: 1 });
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
    await acertarUma(page, 0);
  }
});

test("o PINO é um alvo de verdade (seed determinístico com UF pinada)", async ({ page }) => {
  // acha um seed cuja 1ª pergunta é uma UF com pino — sem sorte envolvida
  let seed = 0;
  for (let c = 1; c < 500; c++) {
    const primeira = perguntaAtual(gerarFase(1, c))!;
    if (ESTADOS[primeira].pino) {
      seed = c;
      break;
    }
  }
  expect(seed).toBeGreaterThan(0);
  await page.addInitScript((s) => {
    Date.now = () => s;
  }, seed);
  await page.reload();

  const pedida = (await page.locator("[data-uf-pedida]").getAttribute("data-uf-pedida"))!;
  const pino = page.locator(`[data-pino][data-uf='${pedida}']`);
  await expect(pino).toHaveCount(1);
  await tocarNoElemento(pino);
  await expect(page.locator("[data-acertos]")).toHaveAttribute("data-acertos", "1");
});

test("persistência: subir de nível sobrevive ao reload", async ({ page }) => {
  await expect(page.locator("main")).toHaveAttribute("data-nivel", "1");
  for (let i = 0; i < 8; i++) await acertarUma(page, i);
  await tocarNoElemento(page.getByLabel("mais difícil"));
  await expect(page.locator("main")).toHaveAttribute("data-nivel", "2");

  await page.reload();
  await expect(page.locator("main")).toHaveAttribute("data-nivel", "2", { timeout: 5000 });
});

test("três formatos: toda UF tem alvo >= 24px (pino quando o path é pequeno)", async ({
  browser,
}) => {
  const formatos = [
    { nome: "celular 390", viewport: { width: 390, height: 844 } },
    { nome: "celular deitado 844", viewport: { width: 844, height: 390 } },
    { nome: "tablet 820", viewport: { width: 820, height: 1180 } },
    { nome: "desktop 1440", viewport: { width: 1440, height: 900 } },
  ];
  const siglas = [
    "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
  ];
  for (const formato of formatos) {
    const contexto = await browser.newContext({ viewport: formato.viewport });
    const pagina = await contexto.newPage();
    await pagina.goto("/estados");
    await expect(pagina.locator("[data-uf-pedida]")).toBeVisible();

    for (const sigla of siglas) {
      const caixa = await pagina.locator(`[data-uf='${sigla}']`).last().boundingBox();
      expect(caixa, `${formato.nome}: ${sigla} sem caixa`).not.toBeNull();
      const menor = Math.min(caixa!.width, caixa!.height);
      expect(menor, `${formato.nome}: alvo de ${sigla} pequeno (${Math.round(menor)}px)`).toBeGreaterThanOrEqual(24);
    }
    await contexto.close();
  }
});
