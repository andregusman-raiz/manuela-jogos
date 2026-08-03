import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { join } from "node:path";
import { tocarNoElemento } from "./_toque";

/**
 * Assistente "Novo jogador" (SPEC-perfis-pela-interface v1.1 §6): criar pelo
 * upload real, recortar o rosto, menina/menino, portão parental, edição com
 * id imutável e apagar-sempre-varre.
 */

const FIXTURE = (nome: string) => join(__dirname, "..", "fixtures", nome);

test.use({ storageState: { cookies: [], origins: [] } }); // sem jogador salvo

async function bancoLimpo(page: Page) {
  await page.goto("/");
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const del = indexedDB.deleteDatabase("manu-jogos");
        del.onsuccess = del.onerror = del.onblocked = () => resolve();
      }),
  );
  await page.reload();
  // hidratação assentada ANTES de tocar (o tap sintético pré-hidratação
  // engolia o clique — mecânica apontada no review do PR #53)
  await expect(page.locator("[data-criar-jogador]")).toBeVisible({ timeout: 10000 });
}

/** Resolve a tabuada do portão parental (padrão do atelie.spec). */
async function passarPortao(page: Page) {
  const portao = page.getByRole("dialog", { name: "Precisa de um adulto" });
  await expect(portao).toBeVisible();
  const conta = await portao.locator("p").filter({ hasText: "×" }).first().textContent();
  const [, a, b] = conta?.match(/(\d+)\s*×\s*(\d+)/) ?? [];
  for (const digito of String(Number(a) * Number(b))) {
    await portao.getByLabel(digito, { exact: true }).click();
  }
  await portao.getByLabel("confirmar").click();
  await expect(portao).toHaveCount(0);
}

async function criarSofia(page: Page) {
  await tocarNoElemento(page.locator("[data-criar-jogador]"));
  await passarPortao(page);
  await page.locator("[data-entrada-galeria]").setInputFiles(FIXTURE("crianca-fundo-branco.png"));
  await expect(page.locator("[data-recorte]")).toBeVisible();
  // arrasta o quadro do rosto um pouco para baixo (drag real)
  const quadro = (await page.locator("[data-recorte]").boundingBox())!;
  await page.mouse.move(quadro.x + quadro.width / 2, quadro.y + quadro.height / 2);
  await page.mouse.down();
  await page.mouse.move(quadro.x + quadro.width / 2, quadro.y + quadro.height / 2 + 30, {
    steps: 4,
  });
  await page.mouse.up();
  await tocarNoElemento(page.getByLabel("rosto escolhido, continuar"));
  await page.locator("[data-campo-nome]").fill("Sofia");
  await tocarNoElemento(page.locator('[data-genero="a"]'));
  await tocarNoElemento(page.locator("[data-salvar]"));
  await expect(page.locator("[data-novo-jogador]")).toHaveCount(0, { timeout: 10000 });
}

test("criar a Sofia: upload real → recorte → menina → app inteiro flexiona", async ({ page }) => {
  await bancoLimpo(page);
  await criarSofia(page);

  // criada JÁ selecionada: hub da Sofia
  await expect(page.getByRole("heading", { name: /Sofia\s*Jogos/ })).toBeVisible();
  await expect(page.getByText("Bem-vinda!")).toBeVisible();
  await expect(page.getByLabel("Ateliê da Sofia", { exact: true })).toBeVisible();
  await expect(page.getByAltText("Sofia").first()).toBeVisible();

  // persiste no reload (IDB + blob URLs recriadas)
  await page.reload();
  await expect(page.getByLabel("Ateliê da Sofia", { exact: true })).toBeVisible();

  // o pipeline RODOU de verdade: o corpo gravado é o recorte da figura,
  // não a imagem inteira de 240×360 (mata o mutante "não remove fundo")
  const registro = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const req = indexedDB.open("manu-jogos");
        req.onsuccess = () => {
          const tx = req.result.transaction(["perfis"], "readonly");
          const g = tx.objectStore("perfis").get("sofia");
          tx.oncomplete = () => {
            req.result.close();
            const r = g.result as
              | { corpoLargura: number; corpoAltura: number; avatar: ArrayBuffer }
              | undefined;
            // ArrayBuffer não serializa pelo evaluate: devolver só números
            resolve(
              r
                ? {
                    corpoLargura: r.corpoLargura,
                    corpoAltura: r.corpoAltura,
                    avatarBytes: r.avatar.byteLength,
                  }
                : null,
            );
          };
        };
      }),
  );
  const r = registro as { corpoLargura: number; corpoAltura: number; avatarBytes: number };
  expect(r.corpoLargura, "fundo/recorte não rodou (largura = imagem inteira)").toBeLessThan(200);
  expect(r.corpoAltura).toBeGreaterThan(r.corpoLargura); // figura em pé
  expect(r.avatarBytes).toBeGreaterThan(1000); // avatar real, não vazio

  // aparece no picker com anel rosa e botão de gerenciar
  await tocarNoElemento(page.locator("[data-config]"));
  await tocarNoElemento(page.locator("[data-trocar-jogador]"));
  const card = page.getByLabel("jogar como Sofia");
  await expect(card).toBeVisible();
  await expect(card).toHaveClass(/ring-manu-rosa/);
  await expect(page.locator('[data-gerenciar="sofia"]')).toBeVisible();
});

test("nome inválido reprova; foto corrompida dá mensagem gentil", async ({ page }) => {
  await bancoLimpo(page);
  await tocarNoElemento(page.locator("[data-criar-jogador]"));
  await passarPortao(page);

  await page.locator("[data-entrada-galeria]").setInputFiles(FIXTURE("corrompido.png"));
  await expect(page.locator("[data-erro]")).toContainText("não abriu");

  await page.locator("[data-entrada-galeria]").setInputFiles(FIXTURE("crianca-fundo-branco.png"));
  await tocarNoElemento(page.getByLabel("rosto escolhido, continuar"));
  await page.locator("[data-campo-nome]").fill("👧👧👧");
  await tocarNoElemento(page.locator("[data-salvar]"));
  await expect(page.locator("[data-erro]")).toContainText("pelo menos uma letra");
});

test("EXIF-6: foto de câmera deitada entra em pé", async ({ page }) => {
  await bancoLimpo(page);
  await tocarNoElemento(page.locator("[data-criar-jogador]"));
  await passarPortao(page);
  await page.locator("[data-entrada-galeria]").setInputFiles(FIXTURE("foto-exif-6.jpg"));
  await expect(page.locator("[data-recorte]")).toBeVisible();
  // a fixture é 300×200 com orientação 6 → exibida deve ficar 200×300 (em pé):
  // a prévia mostrada tem altura > largura
  const previa = (await page.locator("[data-recorte]").locator("..").locator("img").boundingBox())!;
  expect(previa.height).toBeGreaterThan(previa.width);
});

test("portão parental bloqueia resposta errada", async ({ page }) => {
  await bancoLimpo(page);
  await tocarNoElemento(page.locator("[data-criar-jogador]"));
  const portao = page.getByRole("dialog", { name: "Precisa de um adulto" });
  await expect(portao).toBeVisible();
  const conta = await portao.locator("p").filter({ hasText: "×" }).first().textContent();
  const [, a, b] = conta?.match(/(\d+)\s*×\s*(\d+)/) ?? [];
  const errada = String(Number(a) * Number(b) + 1);
  for (const digito of errada) await portao.getByLabel(digito, { exact: true }).click();
  await portao.getByLabel("confirmar").click();
  await expect(portao).toContainText("Não foi essa");
  // continua no portão (não abriu o assistente)
  await expect(page.locator("[data-entrada-galeria]")).toHaveCount(0);
});

test("editar mantém o id e os dados; apagar varre e recriar não herda", async ({ page }) => {
  await bancoLimpo(page);
  await criarSofia(page);

  // memórias da Sofia em TODAS as camadas (progresso, rascunho, galeria, config)
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const req = indexedDB.open("manu-jogos");
        req.onsuccess = () => {
          const tx = req.result.transaction(["contas", "atelie"], "readwrite");
          tx.objectStore("contas").put({
            id: "progresso:sofia",
            nivel: 3,
            melhor: null,
            atualizadoEm: 1,
          });
          tx.objectStore("atelie").put({ id: "rascunho:sofia", operacoes: [], atualizadoEm: 1 });
          tx.objectStore("atelie").put({
            id: "d-sofia-1",
            perfil: "sofia",
            operacoes: [],
            atualizadoEm: 2,
          });
          tx.oncomplete = () => {
            req.result.close();
            resolve();
          };
        };
      }),
  );
  await page.evaluate(() => localStorage.setItem("manu-jogos-ocultos:sofia", '["damas"]'));

  // editar apelido → id continua "sofia" e o progresso segue visível
  await tocarNoElemento(page.locator("[data-config]"));
  await tocarNoElemento(page.locator("[data-trocar-jogador]"));
  await tocarNoElemento(page.locator('[data-gerenciar="sofia"]'));
  await passarPortao(page);
  await page.locator("[data-campo-apelido]").fill("Sofi");
  await tocarNoElemento(page.locator("[data-salvar]"));
  await expect(page.locator("[data-novo-jogador]")).toHaveCount(0, { timeout: 10000 });
  await tocarNoElemento(page.getByLabel("jogar como Sofia"));
  await expect(page.getByLabel("Ateliê da Sofi", { exact: true })).toBeVisible(); // apelido novo
  await page.goto("/contas");
  await expect(page.locator("main")).toHaveAttribute("data-nivel", "3"); // MESMO id

  // apagar varre TUDO; recriar "Sofia" nasce zerada
  await page.goto("/");
  await tocarNoElemento(page.locator("[data-config]"));
  await tocarNoElemento(page.locator("[data-trocar-jogador]"));
  await tocarNoElemento(page.locator('[data-gerenciar="sofia"]'));
  await passarPortao(page);
  await tocarNoElemento(page.locator("[data-apagar]"));
  await tocarNoElemento(page.locator("[data-apagar-confirmar]"));
  await expect(page.locator("[data-novo-jogador]")).toHaveCount(0, { timeout: 10000 });
  await expect(page.getByLabel("jogar como Sofia")).toHaveCount(0);

  const progresso = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const req = indexedDB.open("manu-jogos");
        req.onsuccess = () => {
          const tx = req.result.transaction(["contas"], "readonly");
          const g = tx.objectStore("contas").get("progresso:sofia");
          tx.oncomplete = () => {
            req.result.close();
            resolve(g.result ?? null);
          };
        };
      }),
  );
  expect(progresso, "apagar deveria varrer o progresso").toBeNull();

  const sobras = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const req = indexedDB.open("manu-jogos");
        req.onsuccess = () => {
          const tx = req.result.transaction(["atelie"], "readonly");
          const g = tx.objectStore("atelie").getAllKeys();
          tx.oncomplete = () => {
            req.result.close();
            resolve((g.result as string[]).filter((k) => k.includes("sofia")));
          };
        };
      }),
  );
  expect(sobras, "rascunho/galeria da Sofia deveriam sumir").toEqual([]);
  const ocultos = await page.evaluate(() => localStorage.getItem("manu-jogos-ocultos:sofia"));
  expect(ocultos, "config de ocultos deveria sumir").toBeNull();

  await criarSofia(page);
  await page.goto("/contas");
  await expect(page.locator("main")).toHaveAttribute("data-nivel", "1"); // sem herança
});
