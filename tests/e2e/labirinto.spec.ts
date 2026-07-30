import { expect, test, type Page } from "@playwright/test";
import { tocarNoElemento } from "./_toque";

/**
 * Labirinto da Manu — SPEC §6.2: dedo real, três formatos, fila que sobrevive
 * ao erro, giro relativo de verdade e persistência de fase.
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

async function comandar(page: Page, ...comandos: string[]) {
  for (const rotulo of comandos) {
    await tocarNoElemento(page.getByLabel(rotulo, { exact: true }));
  }
}

async function executarFila(page: Page) {
  await tocarNoElemento(page.getByLabel("executar os comandos"));
  // a execução desabilita os comandos; esperar o ciclo completo evita afirmar
  // "voltou ao início" quando a Manu nem saiu do lugar ainda
  await expect(page.getByLabel("andar para frente", { exact: true })).toBeDisabled();
  await expect(page.getByLabel("andar para frente", { exact: true })).toBeEnabled({
    timeout: 15000,
  });
}

test.beforeEach(async ({ page }) => {
  await page.goto("/labirinto");
  await limparBanco(page);
  await page.reload();
  await expect(page.locator("[data-pos]")).toBeVisible();
});

test("fluxo feliz: do card do hub à estrela da fase 1, confete e fase 2", async ({ page }) => {
  await page.goto("/");
  await tocarNoElemento(page.getByLabel("Labirinto da Manu"));
  await expect(page).toHaveURL(/\/labirinto/);
  await expect(page.locator("main")).toHaveAttribute("data-fase", "1");

  // fase 1: dois passos em frente (solução ótima da SPEC)
  await comandar(page, "andar para frente", "andar para frente");
  await expect(page.locator("[data-fila]")).toHaveAttribute("data-fila", "2");
  await executarFila(page);

  await expect(page.locator("main")).toHaveAttribute("data-fase", "2", { timeout: 8000 });
  await expect(page.locator("canvas[data-ativo='true']")).toBeAttached();

  await tocarNoElemento(page.getByLabel("voltar para os jogos"));
  await expect(page).toHaveURL(/\/$/);
});

test("fase 2 exige GIRAR: frente,frente,direita,frente,frente vence", async ({ page }) => {
  // completa a fase 1 primeiro
  await comandar(page, "andar para frente", "andar para frente");
  await executarFila(page);
  await expect(page.locator("main")).toHaveAttribute("data-fase", "2", { timeout: 8000 });

  await comandar(
    page,
    "andar para frente",
    "andar para frente",
    "girar para a direita",
    "andar para frente",
    "andar para frente",
  );
  await executarFila(page);
  await expect(page.locator("main")).toHaveAttribute("data-fase", "3", { timeout: 10000 });
});

test("bater na parede: posição volta, fila FICA para editar", async ({ page }) => {
  // fase 1: para o norte a borda está a 2 passos
  await comandar(page, "girar para a esquerda", "andar para frente", "andar para frente");
  await expect(page.locator("[data-fila]")).toHaveAttribute("data-fila", "3");
  await executarFila(page);

  // volta ao início, mesma fase, fila intacta
  await expect(page.locator("[data-pos]")).toHaveAttribute("data-pos", "0,1", { timeout: 8000 });
  await expect(page.locator("main")).toHaveAttribute("data-fase", "1");
  await expect(page.locator("[data-fila]")).toHaveAttribute("data-fila", "3");

  // dá para consertar: tirar os comandos e vencer
  await tocarNoElemento(page.getByLabel(/tirar o comando 1/));
  await expect(page.locator("[data-fila]")).toHaveAttribute("data-fila", "2");
  await executarFila(page);
  await expect(page.locator("main")).toHaveAttribute("data-fase", "2", { timeout: 8000 });
});

test("giro sozinho NÃO move a Manu (semântica de giro puro)", async ({ page }) => {
  await expect(page.locator("[data-pos]")).toHaveAttribute("data-pos", "0,1");
  await expect(page.locator("[data-pos]")).toHaveAttribute("data-direcao", "leste");
  await comandar(page, "girar para a esquerda");
  await tocarNoElemento(page.getByLabel("executar os comandos"));
  // DURANTE a execução do giro a posição não muda e a direção vira norte —
  // um giro mutado para deslocamento falharia aqui, antes de qualquer reset
  await expect(page.locator("[data-pos]")).toHaveAttribute("data-direcao", "norte", {
    timeout: 3000,
  });
  await expect(page.locator("[data-pos]")).toHaveAttribute("data-pos", "0,1");
  await expect(page.getByLabel("andar para frente", { exact: true })).toBeEnabled({
    timeout: 15000,
  });
  // termina "fim-da-fila": de volta ao início, apontando leste de novo
  await expect(page.locator("[data-pos]")).toHaveAttribute("data-pos", "0,1");
  await expect(page.locator("main")).toHaveAttribute("data-fase", "1");
});

test("persistência: a fase alcançada sobrevive ao reload", async ({ page }) => {
  await comandar(page, "andar para frente", "andar para frente");
  await executarFila(page);
  await expect(page.locator("main")).toHaveAttribute("data-fase", "2", { timeout: 8000 });

  await page.reload();
  await expect(page.locator("main")).toHaveAttribute("data-fase", "2", { timeout: 5000 });
});

test("três formatos: botões de comando >= 72px e dentro da tela", async ({ browser }) => {
  const formatos = [
    { nome: "celular 390", viewport: { width: 390, height: 844 } },
    { nome: "tablet 820", viewport: { width: 820, height: 1180 } },
    { nome: "desktop 1440", viewport: { width: 1440, height: 900 } },
  ];
  const alvos = [
    "andar para frente",
    "girar para a esquerda",
    "girar para a direita",
    "executar os comandos",
  ];
  for (const formato of formatos) {
    const contexto = await browser.newContext({ viewport: formato.viewport });
    const pagina = await contexto.newPage();
    await pagina.goto("/labirinto");
    await expect(pagina.locator("[data-pos]")).toBeVisible();

    // uma bolha na fila também é alvo interativo — entra na medição
    await tocarNoElemento(pagina.getByLabel("andar para frente", { exact: true }));
    const bolhaFila = await pagina.getByLabel(/tirar o comando 1/).boundingBox();
    expect(bolhaFila!.width, `${formato.nome}: bolha da fila estreita`).toBeGreaterThanOrEqual(72);
    expect(bolhaFila!.height, `${formato.nome}: bolha da fila baixa`).toBeGreaterThanOrEqual(72);

    for (const rotulo of alvos) {
      const caixa = await pagina.getByLabel(rotulo, { exact: true }).boundingBox();
      expect(caixa, `${formato.nome}: ${rotulo} sem caixa`).not.toBeNull();
      expect(caixa!.width, `${formato.nome}: ${rotulo} estreito`).toBeGreaterThanOrEqual(72);
      expect(caixa!.height, `${formato.nome}: ${rotulo} baixo`).toBeGreaterThanOrEqual(72);
      expect(caixa!.x, `${formato.nome}: ${rotulo} fora à esquerda`).toBeGreaterThanOrEqual(0);
      expect(
        caixa!.x + caixa!.width,
        `${formato.nome}: ${rotulo} vaza à direita`,
      ).toBeLessThanOrEqual(formato.viewport.width);
      expect(
        caixa!.y + caixa!.height,
        `${formato.nome}: ${rotulo} vaza abaixo`,
      ).toBeLessThanOrEqual(formato.viewport.height);
    }
    await contexto.close();
  }
});
