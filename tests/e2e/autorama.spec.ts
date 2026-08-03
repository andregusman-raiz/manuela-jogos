import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { tocarNoElemento } from "./_toque";

/**
 * Autorama — SPEC-jogos-corrida §1.4. Primeiro jogo de TEMPO REAL da casa:
 * SEM promessa de equivalência tick-a-tick aqui (isso vive nos units, juiz
 * B2) — o E2E dirige com uma heurística-piloto lendo o HUD a ~10 Hz e assere
 * invariantes e desfechos.
 *
 * Semente 81 (oráculo COMPARTILHADO com autorama.test.ts): o err da IA é -48
 * nas DUAS curvas — a mascote roda nas duas TODA volta, mesmo com rubber-band.
 * O piloto compensa a staleness do HUD (10 Hz + polling ≈ até 200 ms ⇒ 24 u a
 * 120 u/s) com dead-reckoning: entre leituras integra a MESMA física do motor
 * (na primeira versão, sem isso, ele rodava nas curvas e perdia nos 2 engines).
 */

const SEMENTE = 81;

// pista 1 da SPEC, hard-coded como oráculo do piloto: [entrada, fim] das curvas
const CURVAS: Array<[number, number]> = [
  [700, 1000],
  [1700, 2000],
];
const LIMITE = 55;
const FREIO = 90;
const ACEL_TICK = 1; // ACELERACAO·dt

interface Hud {
  situacao: string | null;
  vencedor: string | null;
  ticks: number;
  p0: number;
  v0: number;
  r0: string | null;
  r1: string | null;
  voltas0: number;
  p1: number;
}

function lerHud(page: Page): Promise<Hud> {
  return page.locator("main").evaluate((el) => ({
    situacao: el.getAttribute("data-situacao"),
    vencedor: el.getAttribute("data-vencedor"),
    ticks: Number(el.getAttribute("data-ticks")),
    p0: Number(el.getAttribute("data-progresso-0")),
    v0: Number(el.getAttribute("data-velocidade-0")),
    r0: el.getAttribute("data-rodando-0"),
    r1: el.getAttribute("data-rodando-1"),
    voltas0: Number(el.getAttribute("data-voltas-0")),
    p1: Number(el.getAttribute("data-progresso-1")),
  }));
}

/** Pressiona/solta o botão por PointerEvent com pointerId próprio — é o
 *  contrato de entrada real do componente (conjunto de dedos, §1.3). */
async function dedo(page: Page, indice: 0 | 1, tipo: "pointerdown" | "pointerup") {
  await page.locator(`[data-acelerar="${indice}"]`).evaluate(
    (el, arg) => {
      el.dispatchEvent(
        new PointerEvent(arg.tipo, {
          bubbles: true,
          cancelable: true,
          pointerId: arg.pid,
          pointerType: "touch",
          isPrimary: arg.pid === 1,
          width: 80,
          height: 80,
          pressure: arg.tipo === "pointerdown" ? 0.5 : 0,
        }),
      );
    },
    { tipo, pid: indice + 1 },
  );
}

async function iniciar(page: Page, modo: "manu" | "2p", semente = SEMENTE) {
  await page.goto(`/autorama?semente=${semente}`);
  const rotulo = modo === "manu" ? /correr com/ : "dois jogadores";
  await expect(page.getByLabel(rotulo)).toBeVisible({ timeout: 10000 });
  // a semente exposta prova que o boot assentou antes da largada (a partida
  // no WebKit chegou a nascer com semente 0 — a IA virava outra)
  await expect(page.locator("main")).toHaveAttribute("data-semente", String(semente), {
    timeout: 10000,
  });
  await tocarNoElemento(page.getByLabel(rotulo));
  // contagem 3-2-1 e largada: o HUD só nasce quando o motor entra em "correndo"
  await expect(page.locator("main")).toHaveAttribute("data-situacao", "correndo", {
    timeout: 10000,
  });
}

/** Piloto do teste: dead-reckoning sobre a última leitura do HUD com a MESMA
 *  física da SPEC (acel 60, freio 90), pessimista no sentido seguro — sem
 *  isso a staleness fazia o piloto rodar nas curvas. */
function decidir(p0: number, v0: number, idadeSegundos: number, segurando: boolean): boolean {
  const vEst = segurando
    ? Math.min(120, v0 + 60 * idadeSegundos)
    : Math.max(0, v0 - 90 * idadeSegundos * 0.7); // freio subestimado ⇒ vEst alto ⇒ freia cedo
  const pEst = (p0 + vEst * idadeSegundos) % 2000;
  const emCurva = CURVAS.some(([a, b]) => pEst >= a && pEst < b);
  if (emCurva) return vEst < 44; // 50 rodava: +90 ms de decisão ≈ +5.4 u reais
  const entrada = pEst < CURVAS[0][0] ? CURVAS[0][0] : pEst < CURVAS[1][0] ? CURVAS[1][0] : 2700;
  const dist = entrada - pEst;
  const proxima = Math.min(120, vEst + 2 * ACEL_TICK);
  if (proxima > LIMITE && dist <= (proxima * proxima - LIMITE * LIMITE) / (2 * FREIO) + 30) {
    return false;
  }
  return true;
}

test("vs mascote, semente 81: piloto vence, a mascote roda nas curvas, nível 2 persiste", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await iniciar(page, "manu");

  let segurando = false;
  let mascoteRodou = false;
  let vi55Mais = false;
  const comeco = Date.now();
  let h = await lerHud(page);
  let leituraEm = Date.now();
  while (h.situacao === "correndo" && Date.now() - comeco < 150_000) {
    if (h.r1 === "true") mascoteRodou = true;
    if (h.v0 > LIMITE) vi55Mais = true;
    // +100 ms: idade máxima do dado no HUD de 10 Hz
    const idade = (Date.now() - leituraEm + 100) / 1000;
    const querer = decidir(h.p0, h.v0, idade, segurando);
    if (querer !== segurando) {
      await dedo(page, 0, querer ? "pointerdown" : "pointerup");
      segurando = querer;
    }
    await page.waitForTimeout(40);
    h = await lerHud(page);
    leituraEm = Date.now();
  }

  expect(h.situacao, "a corrida não terminou no teto de tempo").toBe("fim");
  expect(mascoteRodou, "a IA da semente 81 deveria rodar nas curvas").toBe(true);
  expect(vi55Mais, "o piloto nunca passou do limite na reta?").toBe(true);
  expect(h.vencedor).toBe("0");
  await expect(page.locator("[data-fim]")).toContainText("Você ganhou!");
  await expect(page.locator("[data-fim]")).toContainText("Pista 2 aberta");

  // persistência: o nível 2 aparece no menu depois de recarregar
  await page.reload();
  await expect(page.locator('[data-nivel-opcao="2"]')).toBeVisible({ timeout: 10000 });
});

test("segurar sem soltar: spin próprio na primeira curva (nunca sai do trilho)", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await iniciar(page, "manu", 1);
  await dedo(page, 0, "pointerdown");
  await expect
    .poll(async () => (await lerHud(page)).r0, {
      timeout: 20_000,
      message: "o carro deveria rodar ao entrar a 120 na curva de limite 55",
    })
    .toBe("true");
  // rodou NO trilho: progresso segue na entrada da curva, não voltou casas
  const h = await lerHud(page);
  expect(h.p0).toBeGreaterThanOrEqual(690);
  expect(h.p0).toBeLessThanOrEqual(1010);
  await dedo(page, 0, "pointerup");
});

test("botão de pausa congela data-ticks nos DOIS engines; continuar relarga com contagem", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await iniciar(page, "manu", 1);
  await dedo(page, 0, "pointerdown");
  await page.waitForTimeout(800);
  await dedo(page, 0, "pointerup");
  await tocarNoElemento(page.locator("[data-pausar]"));
  await expect(page.locator("[data-pausa]")).toBeVisible();
  await expect(page.locator("main")).toHaveAttribute("data-situacao", "pausa");
  const antes = (await lerHud(page)).ticks;
  expect(antes).toBeGreaterThan(0);
  await page.waitForTimeout(700);
  expect((await lerHud(page)).ticks, "pausa não pode contar ticks").toBe(antes);
  // retomar: contagem de novo e o relógio volta a andar
  await tocarNoElemento(page.getByLabel("continuar a corrida"));
  await expect(page.locator("[data-contagem]")).toBeVisible();
  await expect(page.locator("main")).toHaveAttribute("data-situacao", "correndo", {
    timeout: 10000,
  });
  await expect
    .poll(async () => (await lerHud(page)).ticks, { timeout: 5000 })
    .toBeGreaterThan(antes);
});

test("2 jogadores: cada botão move o SEU carro; dois dedos lógicos ao mesmo tempo movem os dois", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await iniciar(page, "2p", 1);

  // alternado: só o jogador 1 acelera
  await dedo(page, 0, "pointerdown");
  await page.waitForTimeout(700);
  await dedo(page, 0, "pointerup");
  let h = await lerHud(page);
  expect(h.p0).toBeGreaterThan(0);
  const p1Antes = h.p1;

  // alternado: só o jogador 2
  await dedo(page, 1, "pointerdown");
  await page.waitForTimeout(700);
  await dedo(page, 1, "pointerup");
  h = await lerHud(page);
  expect(h.p1).toBeGreaterThan(p1Antes);

  // simultâneo LÓGICO (pointerIds distintos, contrato §1.3 nos 2 engines)
  const base = h;
  await dedo(page, 0, "pointerdown");
  await dedo(page, 1, "pointerdown");
  await page.waitForTimeout(900);
  h = await lerHud(page);
  expect(h.p0, "carro 1 parado com o dedo no botão").toBeGreaterThan(base.p0);
  expect(h.p1, "carro 2 parado com o dedo no botão").toBeGreaterThan(base.p1);
  await dedo(page, 0, "pointerup");
  await dedo(page, 1, "pointerup");
});

test("2 jogadores: multi-touch FÍSICO simultâneo (só android — CDP; iPhone real fica no aceite manual)", async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== "chromium", "Input.dispatchTouchEvent é CDP/Chromium-only (SPEC §1.4)");
  test.setTimeout(60_000);
  await iniciar(page, "2p", 1);

  const caixa0 = (await page.locator('[data-acelerar="0"]').boundingBox())!;
  const caixa1 = (await page.locator('[data-acelerar="1"]').boundingBox())!;
  const cdp = await page.context().newCDPSession(page);
  const pontos = [
    { x: caixa0.x + caixa0.width / 2, y: caixa0.y + caixa0.height / 2, id: 0 },
    { x: caixa1.x + caixa1.width / 2, y: caixa1.y + caixa1.height / 2, id: 1 },
  ];
  const antes = await lerHud(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: pontos });
  await page.waitForTimeout(900);
  const durante = await lerHud(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  expect(durante.p0, "dois dedos físicos: carro 1 não andou").toBeGreaterThan(antes.p0);
  expect(durante.p1, "dois dedos físicos: carro 2 não andou").toBeGreaterThan(antes.p1);
});

test("três formatos: trilho e botão de acelerar inteiros na tela", async ({ browser }) => {
  const formatos = [
    { nome: "celular", viewport: { width: 390, height: 844 } },
    { nome: "deitado", viewport: { width: 844, height: 390 } },
    { nome: "tablet", viewport: { width: 820, height: 1180 } },
  ];
  for (const formato of formatos) {
    const contexto = await browser.newContext({ viewport: formato.viewport });
    const pagina = await contexto.newPage();
    await pagina.goto("/autorama?semente=1");
    await expect(pagina.getByLabel(/correr com/)).toBeVisible({ timeout: 10000 });
    await tocarNoElemento(pagina.getByLabel(/correr com/));
    await expect(pagina.locator("[data-trilho]")).toBeVisible();
    for (const alvo of ["[data-trilho]", '[data-acelerar="0"]']) {
      const caixa = await pagina.locator(alvo).boundingBox();
      expect(caixa, `${formato.nome}: ${alvo} sem caixa`).not.toBeNull();
      expect(caixa!.y + caixa!.height, `${formato.nome}: ${alvo} abaixo da dobra`).toBeLessThanOrEqual(
        formato.viewport.height + 1,
      );
      expect(caixa!.x, `${formato.nome}: ${alvo} fora à esquerda`).toBeGreaterThanOrEqual(-1);
    }
    await contexto.close();
  }
});
