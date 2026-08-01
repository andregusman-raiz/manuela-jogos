import { expect, test } from "@playwright/test";
import { tocarNoElemento } from "./_toque";

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
  const sw = await page
    .evaluate(async () => {
      if (!("serviceWorker" in navigator)) return { controlado: false, precache: false };
      await navigator.serviceWorker.ready;
      // o primeiro load não é controlado (claim chega logo depois); aguarda
      for (let i = 0; i < 50; i++) {
        if (navigator.serviceWorker.controller) break;
        await new Promise((r) => setTimeout(r, 100));
      }
      const controlado = Boolean(navigator.serviceWorker.controller);
      for (let i = 0; i < 50; i++) {
        // o nome do cache vem do SW publicado, nunca hardcoded: um bump de
        // versão não pode transformar esta espera em falsa verificação
        const nomes = (await caches.keys()).filter((n) => n.startsWith("manu-app-"));
        if (nomes.length) {
          const cache = await caches.open(nomes[0]);
          if (
            (await cache.match("/desenhar")) &&
            (await cache.match("/contas")) &&
            (await cache.match("/memoria")) &&
            (await cache.match("/labirinto")) &&
            (await cache.match("/palavras")) &&
            (await cache.match("/forca")) &&
            (await cache.match("/relogio")) &&
            (await cache.match("/lojinha")) &&
            (await cache.match("/genius")) &&
            (await cache.match("/fracoes")) &&
            (await cache.match("/estados")) &&
            (await cache.match("/tangram")) &&
            (await cache.match("/damas")) &&
            (await cache.match("/caca")) &&
            (await cache.match("/ludo")) &&
            (await cache.match("/cobras")) &&
            (await cache.match("/lig4")) &&
            (await cache.match("/mancala"))
          )
            return { controlado, precache: true };
        }
        await new Promise((r) => setTimeout(r, 100));
      }
      return { controlado, precache: false };
    })
    .catch(() => ({ controlado: false, precache: false }));

  // WebKit headless às vezes não ativa SW em localhost — não mascarar: pular
  // explicitamente com anotação, nunca "passar" sem testar
  test.skip(!sw.controlado, `service worker não assumiu controle neste ambiente (${browserName})`);
  // com SW no controle, precache INCOMPLETO é FALHA — nunca vira skip (uma
  // rota fora da CASCA passaria aquecida pela visita online logo abaixo)
  expect(sw.precache, "rota da casca ausente do precache").toBe(true);

  // A checagem de PRECACHE acima roda ANTES de qualquer visita a /contas —
  // visitar primeiro aqueceria o cache em runtime e a asserção viraria mentira.
  // Agora sim: visita online para os chunks JS entrarem no cache-first (HTML
  // precacheado sem chunk renderiza mas não interage; o offline abaixo pega).
  await page.goto("/contas");
  await expect(page.locator("[data-conta]")).toBeVisible();
  await page.goto("/caca");
  await expect(page.locator("[data-instrucao]")).toBeVisible();
  await page.goto("/cobras");
  await expect(page.getByLabel("2 jogadores")).toBeVisible();
  await page.goto("/");

  await context.setOffline(true);
  await page.goto("/desenhar");
  await expect(page.locator(".tela-desenho")).toBeVisible();
  await expect(page.getByLabel("guardar meu desenho")).toBeVisible();

  // o jogo também abre offline E RESPONDE a toque (hidratado, não só HTML)
  await page.goto("/contas");
  const meteoro = page.locator("[data-conta]");
  await expect(meteoro).toBeVisible();
  const conta = (await meteoro.getAttribute("data-conta"))!;
  const [a, op, b] = conta.split(" ");
  const resposta = op === "+" ? +a + +b : op === "−" ? +a - +b : +a * +b;
  await tocarNoElemento(page.getByLabel(`resposta ${resposta}`, { exact: true }));
  await expect(page.locator("[data-acertos]")).toHaveAttribute("data-acertos", "1");

  // a rota mais nova da onda também interage offline (disciplina da onda 1)
  await page.goto("/caca");
  await expect(page.locator("[data-instrucao]")).toBeVisible();
  // achar um número certo prova o JS vivo offline
  const restantesAntes = Number(
    await page.locator("[data-restantes]").getAttribute("data-restantes"),
  );
  const instrucao = (await page.locator("[data-instrucao]").getAttribute("data-instrucao"))!;
  const numeros = await page
    .locator("[data-numero]")
    .evaluateAll((els) => els.map((e) => Number(e.getAttribute("data-numero"))));
  const certo = numeros.find((n) => {
    if (instrucao === "pares") return n % 2 === 0;
    if (instrucao === "impares") return n % 2 === 1;
    const [tipo, alvo] = instrucao.split("-de-");
    return tipo === "multiplos" ? n % Number(alvo) === 0 : Number(alvo) % n === 0;
  })!;
  await tocarNoElemento(page.locator(`[data-numero='${certo}'][data-estado='livre']`).first());
  await expect(page.locator("[data-restantes]")).toHaveAttribute(
    "data-restantes",
    String(restantesAntes - 1),
  );

  // a rota mais nova (Cobras) também INTERAGE offline: entrar na partida
  // prova o chunk hidratado, não só o HTML precacheado
  await page.goto("/cobras");
  await tocarNoElemento(page.getByLabel("2 jogadores"));
  await expect(page.locator("[data-dado-botao]")).toBeVisible();
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
      // SEM número de versão: pedir a versão antiga depois de um upgrade dá
      // VersionError e o teste morreria em timeout mudo
      const req = indexedDB.open("manu-jogos");
      req.onerror = () => resolve(undefined);
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

test("depois de um deploy o app não serve a tela antiga", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.waitForTimeout(800);

  /**
   * O payload de tela do Next (?_rsc=) é pedido ao tocar num link DENTRO do
   * app. Servi-lo do cache prende o aparelho numa versão antiga: quem entra
   * pela home e navega clicando continuava vendo a tela com defeito depois da
   * correção publicada — e só quem digitava o endereço recebia a nova.
   * A imagem de colorir é o oposto: tem de vir do cache, senão acaba o offline.
   */
  const origem = await page.evaluate(async () => {
    const rsc = "/desenhar?_rsc=teste123";
    const asset =
      "/colorir-img/animais/cartoon-horse-standing-in-a-corral-horse-coloring-pages.webp";
    // a versão REAL vem do próprio sw.js publicado — lista hardcoded de nomes
    // virava verificação falsa a cada bump de cache
    const codigoSw = await (await fetch("/sw.js")).text();
    const versao = codigoSw.match(/VERSAO = "(v\d+)"/)?.[1] ?? "";
    const nomes = new Set([
      ...(await caches.keys()).filter((n) => n.startsWith("manu-")),
      `manu-app-${versao}`,
      `manu-assets-${versao}`,
    ]);
    for (const nome of nomes) {
      const c = await caches.open(nome);
      await c.put(rsc, new Response("PLANTADO"));
      await c.put(asset, new Response("PLANTADO"));
    }
    const daTela = await (await fetch(rsc)).text();
    const daImagem = await (await fetch(asset)).text();
    return {
      tela: daTela.startsWith("PLANTADO") ? "cache" : "rede",
      imagem: daImagem.startsWith("PLANTADO") ? "cache" : "rede",
    };
  });

  expect(origem.tela, "tela veio do cache: o app abriria a versão antiga").toBe("rede");
  expect(origem.imagem, "imagem deveria vir do cache, senão não funciona offline").toBe("cache");
});
