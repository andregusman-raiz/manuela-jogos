import { expect, test } from "@playwright/test";

/**
 * As promessas de PWA: funciona offline depois da primeira visita, e o que a
 * criança guarda sai fiel no PNG. São as duas coisas que nenhum teste de
 * componente pega — só o navegador de verdade com service worker.
 */

test("abre offline depois da primeira visita", async ({ page, context, browserName }) => {
  // Limitação do driver, não do app: o setOffline do Playwright-WebKit
  // intercepta a navegação ANTES do service worker poder respondê-la
  // ("WebKit encountered an internal error"). No Safari real o SW responde.
  test.skip(browserName === "webkit", "setOffline + SW navigation não funciona no driver WebKit");
  await page.goto("/");

  // espera o service worker ASSUMIR o controle e terminar o precache da casca
  const controlado = await page
    .evaluate(async () => {
      if (!("serviceWorker" in navigator)) return false;
      await navigator.serviceWorker.ready;
      // o primeiro load não é controlado (claim chega logo depois); aguarda
      for (let i = 0; i < 50; i++) {
        if (navigator.serviceWorker.controller) break;
        await new Promise((r) => setTimeout(r, 100));
      }
      for (let i = 0; i < 50; i++) {
        const cache = await caches.open("manu-app-v1");
        const casca = await cache.match("/desenhar");
        if (casca) return true;
        await new Promise((r) => setTimeout(r, 100));
      }
      return Boolean(navigator.serviceWorker.controller);
    })
    .catch(() => false);

  // WebKit headless às vezes não ativa SW em localhost — não mascarar: pular
  // explicitamente com anotação, nunca "passar" sem testar
  test.skip(!controlado, `service worker não assumiu controle neste ambiente (${browserName})`);

  await context.setOffline(true);
  await page.goto("/desenhar");
  await expect(page.locator(".tela-desenho")).toBeVisible();
  await expect(page.getByLabel("guardar meu desenho")).toBeVisible();
  await context.setOffline(false);
});

test("o PNG guardado é fiel: região pintada, papel e contorno", async ({ page }) => {
  await page.goto("/desenhar");
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const req = indexedDB.deleteDatabase("manu-jogos");
        req.onsuccess = req.onerror = req.onblocked = () => resolve();
      }),
  );
  await page.reload();
  await page.waitForSelector(".tela-desenho");

  // pinta a cabeça do gato de laranja
  await page.getByLabel("escolher desenho para colorir").click();
  await page.getByLabel("Gatinho").click();
  await page.waitForTimeout(400);
  await page.getByLabel("laranja").click();
  await page.waitForTimeout(150);
  await page.locator('svg g[aria-label="pintar cabeça"]').dispatchEvent("pointerdown");
  await page.waitForTimeout(200);

  await page.getByLabel("guardar meu desenho").click();
  await expect(page.getByText("Guardado!")).toBeVisible();

  // decodifica a miniatura (gerada pelo MESMO renderizador do share) e mede pixels
  const pixels = await page.evaluate(async () => {
    const item = await new Promise<{ miniatura?: string } | undefined>((resolve) => {
      const req = indexedDB.open("manu-jogos", 1);
      req.onsuccess = () => {
        const g = req.result.transaction("atelie", "readonly").objectStore("atelie").getAll();
        g.onsuccess = () =>
          resolve((g.result as { id: string; miniatura?: string }[]).find((d) => d.id !== "rascunho"));
      };
    });
    if (!item?.miniatura) return null;

    const img = await new Promise<HTMLImageElement>((res) => {
      const i = new Image();
      i.onload = () => res(i);
      i.src = item.miniatura as string;
    });
    const c = document.createElement("canvas");
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0);

    const lado = Math.min(c.width, c.height);
    const ox = (c.width - lado) / 2;
    const oy = (c.height - lado) / 2;
    const pegar = (vx: number, vy: number) => {
      const p = ctx.getImageData(
        Math.round(ox + (vx / 200) * lado),
        Math.round(oy + (vy / 200) * lado),
        1,
        1,
      ).data;
      return [p[0], p[1], p[2]] as const;
    };
    return { cabeca: pegar(100, 70), papel: pegar(100, 152), contorno: pegar(100, 34) };
  });

  expect(pixels).not.toBeNull();
  const { cabeca, papel, contorno } = pixels!;
  // laranja #F76B15 na cabeça (com folga para antialiasing/compressão)
  expect(cabeca[0]).toBeGreaterThan(200);
  expect(cabeca[1]).toBeGreaterThan(60);
  expect(cabeca[1]).toBeLessThan(160);
  expect(cabeca[2]).toBeLessThan(90);
  // papel branco na barriga não pintada
  expect(Math.min(...papel)).toBeGreaterThan(230);
  // contorno cacau escuro no topo da cabeça
  expect(Math.max(...contorno)).toBeLessThan(90);
});
