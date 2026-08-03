import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { tocarNoElemento } from "./_toque";

/**
 * Corrida — SPEC-jogos-corrida §2.2. Tempo real: o contrato honesto do E2E é
 * invariantes pelo HUD + desfecho, dirigindo com o MESMO controlador
 * bang-bang provado no unit (lá ele tira 3★ em tick-rate; aqui, com o
 * atraso real do polling, o aceite é terminar com ≥1★ em ≤95 s).
 */

const SEMENTE = 42; // oponentes do nível 2 (oráculo compartilhado com o unit)

interface Hud {
  situacao: string | null;
  velocidade: number;
  lateral: number;
  tempo: number;
  estrelas: number;
  ticks: number;
  frente: number;
}

function lerHud(page: Page): Promise<Hud> {
  return page.locator("main").evaluate((el) => ({
    situacao: el.getAttribute("data-situacao"),
    velocidade: Number(el.getAttribute("data-velocidade")),
    lateral: Number(el.getAttribute("data-lateral")),
    tempo: Number(el.getAttribute("data-tempo")),
    estrelas: Number(el.getAttribute("data-estrelas")),
    ticks: Number(el.getAttribute("data-ticks")),
    frente: Number(el.getAttribute("data-frente")),
  }));
}

async function zona(page: Page, lado: "esquerda" | "direita", tipo: "pointerdown" | "pointerup") {
  await page.locator(`[data-zona="${lado}"]`).evaluate(
    (el, arg) => {
      el.dispatchEvent(
        new PointerEvent(arg.tipo, {
          bubbles: true,
          cancelable: true,
          pointerId: arg.pid,
          pointerType: "touch",
          isPrimary: true,
          pressure: arg.tipo === "pointerdown" ? 0.5 : 0,
        }),
      );
    },
    { tipo, pid: lado === "esquerda" ? 1 : 2 },
  );
}

async function iniciar(page: Page, semente = SEMENTE) {
  await page.goto(`/corrida?semente=${semente}`);
  await expect(page.getByLabel("começar a corrida")).toBeVisible({ timeout: 10000 });
  await expect(page.locator("main")).toHaveAttribute("data-semente", String(semente), {
    timeout: 10000,
  });
  await tocarNoElemento(page.getByLabel("começar a corrida"));
  await expect(page.locator("main")).toHaveAttribute("data-situacao", "correndo", {
    timeout: 10000,
  });
}

test("nível 1 completo: controlador bang-bang termina com estrelas e persiste; nível 2 abre", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await iniciar(page);

  // dirige lendo data-lateral (o unit prova o mesmo controlador em 3★)
  type Lado = "esquerda" | "direita" | null;
  let lado: Lado = null;
  let viVelocidadeAlta = false;
  const comeco = Date.now();
  let h = await lerHud(page);
  while (h.situacao === "correndo" && Date.now() - comeco < 150_000) {
    if (h.velocidade > 1100) viVelocidadeAlta = true;
    const querer: Lado = Math.abs(h.lateral) <= 0.25 ? null : h.lateral > 0 ? "esquerda" : "direita";
    if (querer !== lado) {
      if (lado) await zona(page, lado, "pointerup");
      if (querer) await zona(page, querer, "pointerdown");
      lado = querer;
    }
    await page.waitForTimeout(40);
    h = await lerHud(page);
  }

  expect(h.situacao, "a corrida não terminou").toBe("fim");
  expect(viVelocidadeAlta, "nunca chegou perto de VMAX na reta?").toBe(true);
  expect(h.estrelas).toBeGreaterThanOrEqual(1);
  expect(h.tempo, "com o controlador dirigindo, ≤95 s").toBeLessThanOrEqual(95);
  await expect(page.locator("[data-fim]")).toContainText("Chegou!");
  await expect(page.locator('canvas[data-ativo="true"]')).toHaveCount(1); // confete

  // persistência: melhor tempo salvo e nível 2 aberto após reload
  await page.reload();
  await expect(page.locator('[data-nivel-opcao="2"]')).toBeVisible({ timeout: 10000 });
});

test("segurar só a direita: grama derruba a velocidade para ≤ 350 e nunca para", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await iniciar(page, 1);
  await zona(page, "direita", "pointerdown");
  await expect
    .poll(async () => (await lerHud(page)).lateral, { timeout: 15_000 })
    .toBeGreaterThan(1);
  await expect
    .poll(async () => (await lerHud(page)).velocidade, { timeout: 15_000 })
    .toBeLessThanOrEqual(350);
  const h = await lerHud(page);
  expect(h.velocidade).toBeGreaterThan(0); // anda sempre — nunca crash/parada
  await zona(page, "direita", "pointerup");
});

test("pausa por botão congela data-ticks; auto-pausa por blur cobre corrida e contagem", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await iniciar(page, 1);
  await tocarNoElemento(page.locator("[data-pausar]"));
  await expect(page.locator("[data-pausa]")).toBeVisible();
  const antes = (await lerHud(page)).ticks;
  await page.waitForTimeout(700);
  expect((await lerHud(page)).ticks).toBe(antes);

  // retomar e perder o foco DURANTE o 3-2-1
  await tocarNoElemento(page.getByLabel("continuar a corrida"));
  await expect(page.locator("[data-contagem]")).toBeVisible();
  await expect(page.locator("main")).toHaveAttribute("data-situacao", "contagem");
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await expect(page.locator("[data-pausa]")).toBeVisible();
  await page.waitForTimeout(2500);
  await expect(page.locator("main")).toHaveAttribute("data-situacao", "pausa");
});

test("três formatos: estrada e zonas de toque inteiras na tela", async ({ browser }) => {
  const formatos = [
    { nome: "celular", viewport: { width: 390, height: 844 } },
    { nome: "deitado", viewport: { width: 844, height: 390 } },
    { nome: "tablet", viewport: { width: 820, height: 1180 } },
  ];
  for (const formato of formatos) {
    const contexto = await browser.newContext({ viewport: formato.viewport });
    const pagina = await contexto.newPage();
    await pagina.goto("/corrida?semente=1");
    await expect(pagina.getByLabel("começar a corrida")).toBeVisible({ timeout: 10000 });
    await tocarNoElemento(pagina.getByLabel("começar a corrida"));
    await expect(pagina.locator("[data-estrada]")).toBeVisible();
    for (const alvo of ["[data-estrada]", '[data-zona="esquerda"]', '[data-zona="direita"]']) {
      const caixa = await pagina.locator(alvo).boundingBox();
      expect(caixa, `${formato.nome}: ${alvo} sem caixa`).not.toBeNull();
      expect(caixa!.y + caixa!.height, `${formato.nome}: ${alvo} abaixo da dobra`).toBeLessThanOrEqual(
        formato.viewport.height + 1,
      );
    }
    await contexto.close();
  }
});
