import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { tocarNoElemento } from "./_toque";

/**
 * Memória POR PERFIL (SPEC-memoria-por-perfil v1.1): progresso, melhor
 * tentativa, galeria/rascunho e config de jogos visíveis são de cada criança;
 * o dado legado (sem perfil) pertence à Manuela por decisão de produto.
 */

/** O banco só existe depois que o app o abre: visitar 1 jogo cria o schema. */
async function garantirBanco(page: Page) {
  await page.goto("/contas");
  await expect(page.locator("[data-conta]")).toBeVisible();
}

async function semear(page: Page, loja: string, registro: Record<string, unknown>) {
  await page.evaluate(
    ([nomeLoja, reg]) =>
      new Promise<void>((resolve, reject) => {
        const req = indexedDB.open("manu-jogos");
        req.onsuccess = () => {
          const tx = req.result.transaction([nomeLoja as string], "readwrite");
          tx.objectStore(nomeLoja as string).put(reg);
          tx.oncomplete = () => {
            req.result.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
        req.onerror = () => reject(req.error);
      }),
    [loja, registro] as const,
  );
}

async function trocarPara(page: Page, nome: string) {
  await page.goto("/");
  await tocarNoElemento(page.locator("[data-config]"));
  await tocarNoElemento(page.locator("[data-trocar-jogador]"));
  await tocarNoElemento(page.getByLabel(`jogar como ${nome}`));
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const del = indexedDB.deleteDatabase("manu-jogos");
        del.onsuccess = del.onerror = del.onblocked = () => resolve();
      }),
  );
  await page.evaluate(() => {
    for (const chave of Object.keys(localStorage)) {
      if (chave.startsWith("manu-jogos-ocultos")) localStorage.removeItem(chave);
    }
    localStorage.setItem("manu:jogador", "manuela");
  });
  await page.reload();
});

test("progresso legado é da Manuela; Leo e Gustavo começam do zero e evoluem isolados", async ({
  page,
}) => {
  // legado de antes dos perfis: nível 4 nas contas
  await garantirBanco(page);
  await semear(page, "contas", { id: "progresso", nivel: 4, melhor: null, atualizadoEm: 1 });
  await page.reload();
  await expect(page.locator("main")).toHaveAttribute("data-nivel", "4"); // fallback

  await trocarPara(page, "Leo");
  await page.goto("/contas");
  await expect(page.locator("main")).toHaveAttribute("data-nivel", "1"); // isolado

  // Leo evolui direto na chave dele; Gustavo e Manuela não veem
  await semear(page, "contas", { id: "progresso:leo", nivel: 2, melhor: null, atualizadoEm: 2 });
  await page.reload();
  await expect(page.locator("main")).toHaveAttribute("data-nivel", "2");

  await trocarPara(page, "Gustavo");
  await page.goto("/contas");
  await expect(page.locator("main")).toHaveAttribute("data-nivel", "1");

  await trocarPara(page, "Manuela");
  await page.goto("/contas");
  await expect(page.locator("main")).toHaveAttribute("data-nivel", "4");
});

test("monotonia e recorde ATRAVESSAM o fallback: jogar como Manuela preserva o legado", async ({
  page,
}) => {
  // memória legada: nível 2, recorde 6 tentativas (MENOR é melhor)
  await garantirBanco(page);
  await semear(page, "memoria", { id: "progresso", nivel: 2, melhor: 6, atualizadoEm: 1 });
  await page.goto("/memoria");
  await expect(page.locator("main")).toHaveAttribute("data-nivel", "2");

  // completa o tabuleiro (tentativas reais > 6): nível não cai, recorde não piora
  const resolver = async () => {
    for (let par = 0; par < 10; par++) {
      const cartas = page.locator(`[data-par="${par}"]`);
      if ((await cartas.count()) === 0) continue;
      await tocarNoElemento(cartas.first());
      await tocarNoElemento(cartas.last());
      await expect(cartas).toHaveCount(0, { timeout: 4000 });
    }
  };
  await resolver();
  await expect(page.getByText("Você achou todos!")).toBeVisible({ timeout: 5000 });

  const registro = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const req = indexedDB.open("manu-jogos");
        req.onsuccess = () => {
          const tx = req.result.transaction(["memoria"], "readonly");
          const g = tx.objectStore("memoria").get("progresso:manuela");
          tx.oncomplete = () => {
            req.result.close();
            resolve(g.result);
          };
        };
      }),
  );
  const { nivel, melhor } = registro as { nivel: number; melhor: number };
  expect(nivel, "nível regrediu cruzando o fallback").toBeGreaterThanOrEqual(2);
  expect(melhor, "recorde legado foi sombreado").toBeLessThanOrEqual(6);
});

test("config de jogos visíveis é por perfil (troca na MESMA aba)", async ({ page }) => {
  // Manuela esconde as Damas
  await tocarNoElemento(page.locator("[data-config]"));
  await tocarNoElemento(page.locator('[data-alterna="damas"]'));
  await tocarNoElemento(page.getByLabel("pronto, fechar as configurações"));
  await expect(page.getByLabel("Damas", { exact: true })).toHaveCount(0);

  // Leo vê as Damas (config isolada) e esconde o Caça
  await trocarPara(page, "Leo");
  await expect(page.getByLabel("Damas", { exact: true })).toBeVisible();
  await tocarNoElemento(page.locator("[data-config]"));
  await tocarNoElemento(page.locator('[data-alterna="caca"]'));
  await tocarNoElemento(page.getByLabel("pronto, fechar as configurações"));
  await expect(page.getByLabel("Caça-Números", { exact: true })).toHaveCount(0);

  // Manuela mantém o Caça e continua sem as Damas
  await trocarPara(page, "Manuela");
  await expect(page.getByLabel("Caça-Números", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Damas", { exact: true })).toHaveCount(0);
});

test("galeria: desenho legado só da Manuela; desenho do Leo só do Leo", async ({ page }) => {
  const desenho = {
    largura: 10,
    altura: 10,
    operacoes: [],
    atualizadoEm: 10,
    miniatura: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  };
  await garantirBanco(page);
  await semear(page, "atelie", { ...desenho, id: "d-legado-1" }); // sem perfil = legado
  await semear(page, "atelie", { ...desenho, id: "d-leo-1", perfil: "leo", atualizadoEm: 20 });

  const abrirGaleria = async () => {
    await page.goto("/desenhar");
    await page.getByLabel("mais coisas: carimbos, formas, espelho e fundo").click();
    await page.getByLabel("meus desenhos").click();
    await expect(page.getByRole("heading", { name: "Meus desenhos" })).toBeVisible();
  };
  await abrirGaleria();
  await expect(page.locator('img[alt="desenho guardado"]')).toHaveCount(1); // só o legado

  await trocarPara(page, "Leo");
  await abrirGaleria();
  await expect(page.locator('img[alt="desenho guardado"]')).toHaveCount(1); // só o dele
});
