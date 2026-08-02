import { expect, test } from "@playwright/test";
import { JOGOS } from "@/lib/jogos";
import { tocarNoElemento } from "./_toque";

/**
 * Configuração do hub: o adulto escolhe quais jogos aparecem. A escolha
 * persiste em localStorage, esconder não apaga nada e o último jogo visível
 * não pode ser escondido.
 */

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.removeItem("manu-jogos-ocultos"));
  await page.reload();
});

test("esconder um jogo tira do hub, persiste no reload e volta ao mostrar", async ({ page }) => {
  await expect(page.getByLabel("Damas", { exact: true })).toBeVisible();

  await tocarNoElemento(page.locator("[data-config]"));
  await expect(page.getByText("Quais jogos aparecem?")).toBeVisible();
  await expect(page.locator("[data-alterna]")).toHaveCount(JOGOS.length);

  await tocarNoElemento(page.locator('[data-alterna="damas"]'));
  await expect(page.locator('[data-alterna="damas"]')).toHaveAttribute("data-visivel", "false");
  await tocarNoElemento(page.getByLabel("pronto, fechar as configurações"));

  // sumiu do hub — e SÓ ele
  await expect(page.getByLabel("Damas", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Ludo da Manu", { exact: true })).toBeVisible();

  // persiste
  await page.reload();
  await expect(page.getByLabel("Ludo da Manu", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Damas", { exact: true })).toHaveCount(0);

  // nada foi apagado: a rota segue acessível por link direto
  await page.goto("/damas");
  await expect(page.getByLabel("2 jogadores").or(page.locator("main"))).toBeVisible();

  // e volta
  await page.goto("/");
  await tocarNoElemento(page.locator("[data-config]"));
  await tocarNoElemento(page.locator('[data-alterna="damas"]'));
  await expect(page.locator('[data-alterna="damas"]')).toHaveAttribute("data-visivel", "true");
  await tocarNoElemento(page.getByLabel("pronto, fechar as configurações"));
  await expect(page.getByLabel("Damas", { exact: true })).toBeVisible();
});

test("o último jogo visível NÃO pode ser escondido", async ({ page }) => {
  // esconde todos menos o Ateliê direto no storage (19 toques seriam teatro)
  await page.evaluate((ids) => {
    localStorage.setItem("manu-jogos-ocultos", JSON.stringify(ids));
  }, JOGOS.filter((j) => j.id !== "atelie").map((j) => j.id));
  await page.reload();

  await expect(page.getByLabel("Ateliê da Manu", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Damas", { exact: true })).toHaveCount(0);

  await tocarNoElemento(page.locator("[data-config]"));
  await tocarNoElemento(page.locator('[data-alterna="atelie"]'));
  // negado: continua visível (e o hub nunca fica vazio)
  await expect(page.locator('[data-alterna="atelie"]')).toHaveAttribute("data-visivel", "true");
  await tocarNoElemento(page.getByLabel("pronto, fechar as configurações"));
  await expect(page.getByLabel("Ateliê da Manu", { exact: true })).toBeVisible();
});

test("com poucos jogos visíveis os cards continuam na dobra e sem sobreposição", async ({
  page,
}) => {
  await page.evaluate((ids) => {
    localStorage.setItem("manu-jogos-ocultos", JSON.stringify(ids));
  }, JOGOS.slice(5).map((j) => j.id)); // só os 5 primeiros visíveis
  await page.reload();

  const altura = page.viewportSize()!.height;
  const caixas: Array<{ nome: string; x: number; y: number; width: number; height: number }> = [];
  for (const jogo of JOGOS.slice(0, 5)) {
    const card = page.getByLabel(jogo.nome, { exact: true });
    await expect(card).toBeVisible();
    const caixa = (await card.boundingBox())!;
    expect(caixa.y + caixa.height, `${jogo.nome} abaixo da dobra`).toBeLessThanOrEqual(altura);
    caixas.push({ nome: jogo.nome, ...caixa });
  }
  for (let a = 0; a < caixas.length; a++) {
    for (let b = a + 1; b < caixas.length; b++) {
      const p = caixas[a];
      const q = caixas[b];
      const sobrepoe =
        p.x + 1 < q.x + q.width &&
        q.x + 1 < p.x + p.width &&
        p.y + 1 < q.y + q.height &&
        q.y + 1 < p.y + p.height;
      expect(sobrepoe, `${p.nome} sobrepõe ${q.nome}`).toBe(false);
    }
  }
});

test("lixo no localStorage não quebra o hub (ids inválidos são descartados)", async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem(
      "manu-jogos-ocultos",
      JSON.stringify(["jogo-que-nao-existe", 42, null, "damas"]),
    );
  });
  await page.reload();
  // só o id válido é aplicado; o resto é ignorado sem crash
  await expect(page.getByLabel("Damas", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Ateliê da Manu", { exact: true })).toBeVisible();
});
