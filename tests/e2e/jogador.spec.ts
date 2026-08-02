import { expect, test } from "@playwright/test";
import { tocarNoElemento } from "./_toque";

/**
 * Tela "Quem vai jogar?" — porta de entrada do app (fase 2 da identidade,
 * primeiro passo). Primeira visita escolhe o perfil; a escolha persiste;
 * "Trocar jogador" nas configurações volta para a escolha.
 */

test.use({ storageState: { cookies: [], origins: [] } }); // SEM jogador salvo

test("primeira visita: escolher a Manuela revela o hub e persiste", async ({ page }) => {
  await page.goto("/");
  const escolha = page.locator("[data-escolha-jogador]");
  await expect(escolha).toBeVisible();
  await expect(page.getByText("Quem vai jogar?")).toBeVisible();
  // dois perfis: Manuela e Leo, cada card com figura + nome
  await expect(page.locator("[data-perfil]")).toHaveCount(2);
  await expect(page.getByLabel("jogar como Manuela")).toBeVisible();
  await expect(page.getByLabel("jogar como Leo")).toBeVisible();

  // o hub atrás não é alcançável: o card do Ateliê está coberto pela escolha
  await tocarNoElemento(page.getByLabel("jogar como Manuela"));
  await expect(escolha).toHaveCount(0);
  await expect(page.getByLabel("Ateliê da Manu", { exact: true })).toBeVisible();

  // persiste: recarregar NÃO pergunta de novo
  await page.reload();
  await expect(page.getByLabel("Ateliê da Manu", { exact: true })).toBeVisible();
  await expect(page.locator("[data-escolha-jogador]")).toHaveCount(0);
});

test("escolher o LEO troca nome, gênero e figura no app inteiro", async ({ page }) => {
  await page.goto("/");
  await tocarNoElemento(page.getByLabel("jogar como Leo"));

  // hub fala com o Leo: título, saudação no masculino e catálogo flexionado
  await expect(page.getByRole("heading", { name: /Leo\s*Jogos/ })).toBeVisible();
  await expect(page.getByText("Bem-vindo!")).toBeVisible();
  await expect(page.getByLabel("Ateliê do Leo", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Ludo do Leo", { exact: true })).toBeVisible();
  // a figura é a do Leo (alt do perfil)
  await expect(page.getByAltText("Leo").first()).toBeVisible();

  // dentro de um jogo com IA: o modo vs-mascote fala "Com o Leo"
  await page.goto("/lig4");
  await expect(page.getByLabel("jogar com o Leo")).toBeVisible();

  // trocar de volta para a Manuela restaura tudo
  await page.goto("/");
  await tocarNoElemento(page.locator("[data-config]"));
  await tocarNoElemento(page.locator("[data-trocar-jogador]"));
  await tocarNoElemento(page.getByLabel("jogar como Manuela"));
  await expect(page.getByText("Bem-vinda!")).toBeVisible();
  await expect(page.getByLabel("Ateliê da Manu", { exact: true })).toBeVisible();
});

test("trocar jogador nas configurações volta para a escolha", async ({ page }) => {
  await page.goto("/");
  await tocarNoElemento(page.getByLabel("jogar como Manuela"));
  await expect(page.getByLabel("Ateliê da Manu", { exact: true })).toBeVisible();

  await tocarNoElemento(page.locator("[data-config]"));
  await tocarNoElemento(page.locator("[data-trocar-jogador]"));
  await expect(page.locator("[data-escolha-jogador]")).toBeVisible();

  // escolher de novo volta ao hub com tudo no lugar
  await tocarNoElemento(page.getByLabel("jogar como Manuela"));
  await expect(page.getByLabel("Ateliê da Manu", { exact: true })).toBeVisible();
});

test("lixo na chave do jogador cai na escolha (não trava o app)", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.setItem("manu:jogador", "perfil-que-nao-existe"));
  await page.reload();
  await expect(page.locator("[data-escolha-jogador]")).toBeVisible();
  await tocarNoElemento(page.getByLabel("jogar como Manuela"));
  await expect(page.getByLabel("Ateliê da Manu", { exact: true })).toBeVisible();
});

test("pré-hidratação: o hub SSR fica ESCONDIDO para quem nunca escolheu", async ({
  browser,
}) => {
  // bloqueia os chunks JS: o script inline do gate roda, a hidratação nunca
  // chega — o hub não pode ficar clicável nesse limbo (review PR #47)
  const contexto = await browser.newContext();
  const page = await contexto.newPage();
  // só o JS: o CSS do véu precisa carregar (é ele que esconde)
  await page.route(
    "**/_next/static/chunks/**",
    (rota) => (rota.request().url().endsWith(".css") ? rota.continue() : rota.abort()),
  );
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(500);

  await expect(page.locator("html")).toHaveAttribute("data-sem-jogador", "");
  // os cards existem no DOM mas estão invisíveis (véu CSS)
  await expect(page.getByLabel("Ateliê da Manu", { exact: true })).toBeHidden();
  await expect(page.locator("[data-config]")).toBeHidden();
  await contexto.close();
});

test("pré-hidratação: quem JÁ escolheu vê o hub normalmente sem véu", async ({ browser }) => {
  const contexto = await browser.newContext();
  await contexto.addInitScript(() => localStorage.setItem("manu:jogador", "manuela"));
  const page = await contexto.newPage();
  await page.route(
    "**/_next/static/chunks/**",
    (rota) => (rota.request().url().endsWith(".css") ? rota.continue() : rota.abort()),
  );
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(500);

  await expect(page.locator("html")).not.toHaveAttribute("data-sem-jogador", "");
  await expect(page.getByLabel("Ateliê da Manu", { exact: true })).toBeVisible();
  await contexto.close();
});

test("três formatos: card de escolha inteiro e tocável", async ({ browser }) => {
  const formatos = [
    { nome: "celular", viewport: { width: 390, height: 844 } },
    { nome: "tablet", viewport: { width: 820, height: 1180 } },
    { nome: "deitado", viewport: { width: 844, height: 390 } },
  ];
  for (const formato of formatos) {
    const contexto = await browser.newContext({ viewport: formato.viewport });
    const pagina = await contexto.newPage();
    await pagina.goto("/");
    const card = await pagina.getByLabel("jogar como Manuela").boundingBox();
    expect(card, `${formato.nome}: card sem caixa`).not.toBeNull();
    expect(card!.width, `${formato.nome}: card estreito`).toBeGreaterThanOrEqual(150);
    expect(card!.y, `${formato.nome}: card acima da tela`).toBeGreaterThanOrEqual(0);
    expect(
      card!.y + card!.height,
      `${formato.nome}: card cortado embaixo`,
    ).toBeLessThanOrEqual(formato.viewport.height + 1);
    await contexto.close();
  }
});
