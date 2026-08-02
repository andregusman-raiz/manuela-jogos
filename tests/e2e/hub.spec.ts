import { expect, test } from "@playwright/test";
import { JOGOS } from "@/lib/jogos";

/**
 * O hub é a porta de entrada da criança: TODOS os jogos precisam estar na
 * DOBRA, sem scroll — foi assim que a Palavra Mágica "sumiu" com 5 cards
 * (existia no DOM, 380px abaixo da tela, e nada indicava rolagem).
 */

test("todos os jogos aparecem na dobra, sem rolar", async ({ page }) => {
  await page.goto("/");
  const altura = page.viewportSize()!.height;
  const caixas: Array<{ nome: string; x: number; y: number; width: number; height: number }> = [];
  for (const jogo of JOGOS) {
    const card = page.getByLabel(jogo.nome, { exact: true });
    await expect(card, jogo.nome).toBeVisible();
    const caixa = await card.boundingBox();
    expect(caixa, `${jogo.nome} sem caixa`).not.toBeNull();
    expect(caixa!.width * caixa!.height, `${jogo.nome} sem área`).toBeGreaterThan(0);
    expect(caixa!.y, `${jogo.nome} começa acima da tela`).toBeGreaterThanOrEqual(0);
    expect(
      caixa!.y + caixa!.height,
      `${jogo.nome} termina abaixo da dobra (${Math.round(caixa!.y + caixa!.height)} > ${altura})`,
    ).toBeLessThanOrEqual(altura);
    caixas.push({ nome: jogo.nome, ...caixa! });
  }
  // dobra cheia não vale com cards um em cima do outro (gate endurecido, J12)
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

test("três formatos: a dobra segura os 5 cards em tablet e desktop também", async ({
  browser,
}) => {
  const formatos = [
    { nome: "celular 390", viewport: { width: 390, height: 844 } },
    { nome: "tablet 820", viewport: { width: 820, height: 1180 } },
    { nome: "desktop 1440", viewport: { width: 1440, height: 900 } },
  ];
  for (const formato of formatos) {
    const contexto = await browser.newContext({ viewport: formato.viewport });
    await contexto.addInitScript(() => localStorage.setItem("manu:jogador", "manuela"));
    const pagina = await contexto.newPage();
    await pagina.goto("/");
    for (const jogo of JOGOS) {
      const caixa = await pagina.getByLabel(jogo.nome, { exact: true }).boundingBox();
      expect(caixa, `${formato.nome}: ${jogo.nome} sem caixa`).not.toBeNull();
      expect(
        caixa!.y + caixa!.height,
        `${formato.nome}: ${jogo.nome} abaixo da dobra`,
      ).toBeLessThanOrEqual(formato.viewport.height);
    }
    await contexto.close();
  }
});
