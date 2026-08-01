import { expect, test, type Page } from "@playwright/test";
import { JOGOS } from "@/lib/jogos";

/**
 * Gate de regressão do formato DEITADO (844×390) — nasceu do QAT 2026-07-31,
 * que achou cartas da Memória sobrepostas, a 4ª linha do Caça cortada, a
 * palavra da Forca escondida atrás do teclado e cards do hub invisíveis
 * (bg-manu-nuvem sobre fundo nuvem). Cada teste aqui FALHAVA no código
 * pré-correção.
 */

const DEITADO = { width: 844, height: 390 };

type Caixa = { x: number; y: number; width: number; height: number };

function dentroDaTela(caixa: Caixa, tela: { width: number; height: number }): boolean {
  return (
    caixa.x >= -1 &&
    caixa.y >= -1 &&
    caixa.x + caixa.width <= tela.width + 1 &&
    caixa.y + caixa.height <= tela.height + 1
  );
}

function sobrepoe(a: Caixa, b: Caixa): boolean {
  // 1px de tolerância: bordas encostadas não são sobreposição
  return (
    a.x + 1 < b.x + b.width &&
    b.x + 1 < a.x + a.width &&
    a.y + 1 < b.y + b.height &&
    b.y + 1 < a.y + a.height
  );
}

async function caixas(page: Page, seletor: string): Promise<Caixa[]> {
  const alvos = await page.locator(seletor).all();
  const resultado: Caixa[] = [];
  for (const alvo of alvos) {
    const caixa = await alvo.boundingBox();
    expect(caixa, `${seletor} sem caixa`).not.toBeNull();
    resultado.push(caixa!);
  }
  return resultado;
}

async function novaPagina(browser: import("@playwright/test").Browser, largura = 844, altura = 390) {
  const contexto = await browser.newContext({ viewport: { width: largura, height: altura } });
  return { contexto, page: await contexto.newPage() };
}

test("hub deitado: Manu some, nada vaza na horizontal e todo card é alcançável", async ({
  browser,
}) => {
  const { contexto, page } = await novaPagina(browser);
  await page.goto("/");

  // a ilustração cede o espaço para o grid (deitado:hidden)
  await expect(page.getByAltText("Manuela")).toBeHidden();

  // scroll vertical é aceito (14 jogos não cabem em 390px); horizontal nunca
  const vazaHorizontal = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(vazaHorizontal, "hub com overflow horizontal").toBe(false);

  for (const jogo of JOGOS) {
    const card = page.getByLabel(jogo.nome, { exact: true });
    await card.scrollIntoViewIfNeeded();
    await expect(card, jogo.nome).toBeVisible();
    const caixa = (await card.boundingBox())!;
    expect(dentroDaTela(caixa, DEITADO), `${jogo.nome} cortado após scroll`).toBe(true);
  }
  await contexto.close();
});

// Limitação assumida: compara backgroundColor computado — pega a classe do bug
// real (mesma cor sólida do fundo), não um card transparente/opacity:0. Teste
// de contraste por pixel seria o upgrade se essa classe de bug voltar diferente.
test("hub: nenhum card tem a cor do fundo (Palavra Mágica e Damas sumiam)", async ({ page }) => {
  await page.goto("/");
  const corDoFundo = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  for (const jogo of JOGOS) {
    const corDoCard = await page
      .getByLabel(jogo.nome, { exact: true })
      .evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(corDoCard, `${jogo.nome} invisível: card na cor do fundo`).not.toBe(corDoFundo);
  }
});

test("memória deitada: todas as cartas na tela, nenhuma em cima da outra", async ({ browser }) => {
  const { contexto, page } = await novaPagina(browser);
  await page.goto("/memoria");
  await expect(page.locator("button[data-par]")).toHaveCount(12);

  const cartas = await caixas(page, "button[data-par]");
  cartas.forEach((caixa, i) => {
    expect(dentroDaTela(caixa, DEITADO), `carta ${i + 1} cortada pela borda`).toBe(true);
  });
  for (let a = 0; a < cartas.length; a++) {
    for (let b = a + 1; b < cartas.length; b++) {
      expect(sobrepoe(cartas[a], cartas[b]), `cartas ${a + 1} e ${b + 1} sobrepostas`).toBe(false);
    }
  }
  await contexto.close();
});

test("caça deitado: as 16 casas inteiras na tela, sem sobreposição", async ({ browser }) => {
  const { contexto, page } = await novaPagina(browser);
  await page.goto("/caca");
  await expect(page.locator("button[data-numero]")).toHaveCount(16);

  const casas = await caixas(page, "button[data-numero]");
  casas.forEach((caixa, i) => {
    expect(dentroDaTela(caixa, DEITADO), `casa ${i + 1} cortada pela borda`).toBe(true);
  });
  for (let a = 0; a < casas.length; a++) {
    for (let b = a + 1; b < casas.length; b++) {
      expect(sobrepoe(casas[a], casas[b]), `casas ${a + 1} e ${b + 1} sobrepostas`).toBe(false);
    }
  }
  await contexto.close();
});

for (const tela of [
  { nome: "844×390", width: 844, height: 390 },
  { nome: "iPhone SE 667×375", width: 667, height: 375 },
]) {
  test(`forca deitada ${tela.nome}: palavra visível fora do teclado, teclado inteiro`, async ({
    browser,
  }) => {
    const { contexto, page } = await novaPagina(browser, tela.width, tela.height);
    await page.goto("/forca");
    const palavra = page.locator("p[data-palavra]");
    await expect(palavra).toBeVisible();

    const caixaPalavra = (await palavra.boundingBox())!;
    expect(dentroDaTela(caixaPalavra, tela), "palavra cortada pela borda").toBe(true);

    const letras = await caixas(page, "button[aria-label^='letra ']");
    expect(letras).toHaveLength(26);
    for (const [i, caixa] of letras.entries()) {
      expect(dentroDaTela(caixa, tela), `tecla ${i + 1} cortada pela borda`).toBe(true);
      expect(sobrepoe(caixaPalavra, caixa), `palavra escondida atrás da tecla ${i + 1}`).toBe(
        false,
      );
    }
    await contexto.close();
  });
}

// Onda tabuleiros: no deitado, os alvos de toque dos jogos de grade não podem
// se sobrepor nem vazar (mesmos invariantes do resto do gate).
const TABULEIROS_DEITADO: Array<{
  rota: string;
  entrada: string;
  seletor: string;
  quantidade: number;
}> = [
  { rota: "/lig4", entrada: "jogar com alguém", seletor: "[data-col]", quantidade: 7 },
  { rota: "/mancala", entrada: "jogar com alguém", seletor: "[data-cova]", quantidade: 12 },
  { rota: "/rota", entrada: "jogar com alguém", seletor: "circle[data-casa]", quantidade: 9 },
];

for (const jogo of TABULEIROS_DEITADO) {
  test(`tabuleiro deitado ${jogo.rota}: alvos inteiros na tela e sem sobreposição`, async ({
    browser,
  }) => {
    const { contexto, page } = await novaPagina(browser);
    await page.goto(jogo.rota);
    const entrada = page.getByLabel(jogo.entrada);
    await entrada.click();
    await expect(page.locator(jogo.seletor).first()).toBeVisible();

    const alvos = await caixas(page, jogo.seletor);
    expect(alvos).toHaveLength(jogo.quantidade);
    alvos.forEach((caixa, i) => {
      expect(dentroDaTela(caixa, DEITADO), `${jogo.rota}: alvo ${i + 1} cortado`).toBe(true);
    });
    for (let a = 0; a < alvos.length; a++) {
      for (let b = a + 1; b < alvos.length; b++) {
        expect(
          sobrepoe(alvos[a], alvos[b]),
          `${jogo.rota}: alvos ${a + 1} e ${b + 1} sobrepostos`,
        ).toBe(false);
      }
    }
    await contexto.close();
  });
}

test("tangram: bandeja inicial legível — peças dentro do tabuleiro e sem atropelo", async ({
  browser,
}) => {
  const { contexto, page } = await novaPagina(browser);
  await page.goto("/tangram");
  await expect(page.locator("[data-peca]")).toHaveCount(7);

  // o tabuleiro precisa estar RENDERIZADO no deitado — pontos certos num SVG
  // colapsado a 0px não contam como bandeja legível
  const svg = await page.locator("svg[aria-label^='silhueta']").boundingBox();
  expect(svg).not.toBeNull();
  expect(svg!.width, "tabuleiro colapsado na horizontal").toBeGreaterThan(100);
  expect(svg!.height, "tabuleiro colapsado na vertical").toBeGreaterThan(100);
  await expect(page.locator("[data-peca='g1']")).toBeVisible();

  // coordenadas LÓGICAS direto do atributo points — independem de letterbox
  const pecas = await page.locator("[data-peca]").evaluateAll((els) =>
    els.map((el) => {
      const pontos = (el.getAttribute("points") ?? "")
        .trim()
        .split(/\s+/)
        .map((par) => par.split(",").map(Number) as [number, number]);
      const xs = pontos.map(([x]) => x);
      const ys = pontos.map(([, y]) => y);
      return {
        nome: el.getAttribute("data-peca")!,
        x1: Math.min(...xs),
        y1: Math.min(...ys),
        x2: Math.max(...xs),
        y2: Math.max(...ys),
      };
    }),
  );

  for (const peca of pecas) {
    expect(peca.x1, `${peca.nome} vaza a esquerda`).toBeGreaterThanOrEqual(-1);
    expect(peca.y1, `${peca.nome} vaza o topo`).toBeGreaterThanOrEqual(-1);
    expect(peca.x2, `${peca.nome} vaza a direita`).toBeLessThanOrEqual(201);
    expect(peca.y2, `${peca.nome} vaza embaixo`).toBeLessThanOrEqual(201);
  }

  // Na fila única antiga, bboxes vizinhos dividiam 43%+ da área — peças
  // indistinguíveis. Triângulos vizinhos legítimos tocam <20% (cantos vazios).
  for (let a = 0; a < pecas.length; a++) {
    for (let b = a + 1; b < pecas.length; b++) {
      const p = pecas[a];
      const q = pecas[b];
      const larguraComum = Math.min(p.x2, q.x2) - Math.max(p.x1, q.x1);
      const alturaComum = Math.min(p.y2, q.y2) - Math.max(p.y1, q.y1);
      if (larguraComum <= 0 || alturaComum <= 0) continue;
      const intersecao = larguraComum * alturaComum;
      const menorArea = Math.min(
        (p.x2 - p.x1) * (p.y2 - p.y1),
        (q.x2 - q.x1) * (q.y2 - q.y1),
      );
      expect(
        intersecao / menorArea,
        `${p.nome} e ${q.nome} atropeladas na bandeja (${Math.round((intersecao / menorArea) * 100)}%)`,
      ).toBeLessThan(0.2);
    }
  }
  await contexto.close();
});
