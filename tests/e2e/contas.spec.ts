import { expect, test, type Page } from "@playwright/test";
import { tocarNoElemento } from "./_toque";

/**
 * Foguete das Contas — SPEC §6.2: toque com dedo real, três formatos de tela,
 * fluxo feliz até o confete, erro que não destrói estado e persistência.
 */

/** Oráculo do teste: resolve a conta exibida no meteoro. */
function calcular(conta: string): number {
  const [a, op, b] = conta.split(" ");
  const x = Number(a);
  const y = Number(b);
  if (op === "+") return x + y;
  if (op === "−") return x - y;
  return x * y;
}

async function limparBanco(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const req = indexedDB.deleteDatabase("manu-jogos");
        req.onsuccess = req.onerror = req.onblocked = () => resolve();
      }),
  );
}

/** Acerta a conta atual tocando a bolha certa com dedo de verdade. */
async function acertarUma(page: Page) {
  const meteoro = page.locator("[data-conta]");
  await expect(meteoro).toBeVisible();
  const conta = await meteoro.getAttribute("data-conta");
  const resposta = calcular(conta!);
  const antes = Number(await page.locator("[data-acertos]").getAttribute("data-acertos"));
  await tocarNoElemento(page.getByLabel(`resposta ${resposta}`, { exact: true }));
  await expect(page.locator("[data-acertos]")).toHaveAttribute("data-acertos", String(antes + 1));
  // espera a próxima rodada spawnar (ou a fase completar)
  if (antes + 1 < 10) await expect(page.locator("[data-conta]")).toBeVisible({ timeout: 3000 });
}

test.beforeEach(async ({ page }) => {
  await page.goto("/contas");
  await limparBanco(page);
  await page.reload();
  await expect(page.locator("[data-conta]")).toBeVisible();
});

test("fluxo feliz: do card do hub aos 10 acertos, confete DE VERDADE e volta", async ({ page }) => {
  // entra como a criança entra: pelo card, com dedo — nunca click de 1px
  await page.goto("/");
  await tocarNoElemento(page.getByLabel("Foguete das Contas"));
  await expect(page).toHaveURL(/\/contas/);
  await expect(page.locator("[data-conta]")).toBeVisible();

  for (let i = 0; i < 10; i++) await acertarUma(page);

  // fase completa: partícula viva (data-ativo), não só canvas presente no DOM
  await expect(page.locator("canvas[data-ativo='true']")).toBeAttached();
  await expect(page.getByText("Você acertou tudo!")).toBeVisible();
  await expect(page.getByLabel("jogar de novo")).toBeVisible();
  await expect(page.getByLabel("mais difícil")).toBeVisible();

  await tocarNoElemento(page.getByLabel("voltar para os jogos"));
  await expect(page).toHaveURL(/\/$/);
});

test("resposta errada não avança, não troca a conta e não trava o jogo", async ({ page }) => {
  const conta = await page.locator("[data-conta]").getAttribute("data-conta");
  const resposta = calcular(conta!);
  const opcoes = page.locator("[aria-label^='resposta ']");
  await expect(opcoes).toHaveCount(4);

  // toca uma bolha ERRADA qualquer
  const rotulos = await opcoes.evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
  const errada = rotulos.find((r) => r !== `resposta ${resposta}`)!;
  await tocarNoElemento(page.getByLabel(errada, { exact: true }));

  await expect(page.locator("[data-acertos]")).toHaveAttribute("data-acertos", "0");
  await expect(page.locator("[data-conta]")).toHaveAttribute("data-conta", conta!);

  // e a certa continua funcionando depois do erro
  await acertarUma(page);
});

test("persistência: subir de nível sobrevive ao reload", async ({ page }) => {
  await expect(page.locator("main")).toHaveAttribute("data-nivel", "1");
  for (let i = 0; i < 10; i++) await acertarUma(page);
  await tocarNoElemento(page.getByLabel("mais difícil"));
  await expect(page.locator("main")).toHaveAttribute("data-nivel", "2");

  await page.reload();
  await expect(page.locator("main")).toHaveAttribute("data-nivel", "2");
  await expect(page.locator("[data-conta]")).toBeVisible();
});

test("três formatos: alvos de toque >= 72px em celular, tablet e desktop", async ({ browser }) => {
  const formatos = [
    { nome: "celular 390", viewport: { width: 390, height: 844 } },
    { nome: "tablet 820", viewport: { width: 820, height: 1180 } },
    { nome: "desktop 1440", viewport: { width: 1440, height: 900 } },
  ];
  for (const formato of formatos) {
    const contexto = await browser.newContext({ viewport: formato.viewport });
    const pagina = await contexto.newPage();
    await pagina.goto("/contas");
    await expect(pagina.locator("[data-conta]")).toBeVisible();

    for (const alvo of await pagina.locator("[aria-label^='resposta ']").all()) {
      const caixa = await alvo.boundingBox();
      expect(caixa, `${formato.nome}: bolha sem caixa`).not.toBeNull();
      expect(caixa!.width, `${formato.nome}: bolha estreita demais`).toBeGreaterThanOrEqual(72);
      expect(caixa!.height, `${formato.nome}: bolha baixa demais`).toBeGreaterThanOrEqual(72);
      // dentro do viewport: alvo gigante fora da tela também seria "grande"
      expect(caixa!.x, `${formato.nome}: bolha à esquerda da tela`).toBeGreaterThanOrEqual(0);
      expect(caixa!.y, `${formato.nome}: bolha acima da tela`).toBeGreaterThanOrEqual(0);
      expect(
        caixa!.x + caixa!.width,
        `${formato.nome}: bolha vaza à direita`,
      ).toBeLessThanOrEqual(formato.viewport.width);
      expect(
        caixa!.y + caixa!.height,
        `${formato.nome}: bolha vaza abaixo`,
      ).toBeLessThanOrEqual(formato.viewport.height);
    }
    const voltar = await pagina.getByLabel("voltar para os jogos").boundingBox();
    expect(voltar!.width, `${formato.nome}: voltar pequeno`).toBeGreaterThanOrEqual(56);
    await contexto.close();
  }
});

test("upgrade v3→v6 preserva galeria E progresso antigos e cria as gavetas novas", async ({
  page,
}) => {
  // recria um banco v3 com o esquema antigo + DUAS sentinelas: desenho na
  // atelie e progresso na contas — uma mutação apague-e-recrie de gaveta
  // antiga morre aqui (blocker #1 do juízo da onda 3)
  await limparBanco(page);
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const req = indexedDB.open("manu-jogos", 3);
        req.onupgradeneeded = () => {
          // o v3 REAL completo, como estava publicado na onda 2
          for (const nome of [
            "atelie",
            "contas",
            "memoria",
            "labirinto",
            "palavras",
            "forca",
            "relogio",
            "lojinha",
            "genius",
          ]) {
            const loja = req.result.createObjectStore(nome, { keyPath: "id" });
            loja.createIndex("atualizadoEm", "atualizadoEm");
          }
        };
        req.onsuccess = () => {
          const tx = req.result.transaction(["atelie", "contas"], "readwrite");
          tx.objectStore("atelie").put({ id: "sentinela-v1", atualizadoEm: 111, operacoes: [] });
          tx.objectStore("contas").put({ id: "progresso", nivel: 4, melhor: null, atualizadoEm: 222 });
          tx.oncomplete = () => {
            req.result.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
        req.onerror = () => reject(req.error);
      }),
  );

  // recarregar faz o app abrir na versão atual e migrar
  await page.reload();
  await expect(page.locator("[data-conta]")).toBeVisible();

  const lerBanco = () =>
    page.evaluate(
      () =>
        new Promise<{
          versao: number;
          lojas: string[];
          sentinela: boolean;
          nivelContas: number;
        }>((resolve, reject) => {
          const req = indexedDB.open("manu-jogos");
          req.onsuccess = () => {
            const bd = req.result;
            const tx = bd.transaction(["atelie", "contas"], "readonly");
            const g = tx.objectStore("atelie").get("sentinela-v1");
            const p = tx.objectStore("contas").get("progresso");
            tx.oncomplete = () => {
              resolve({
                versao: bd.version,
                lojas: [...bd.objectStoreNames].sort(),
                sentinela: Boolean(g.result),
                nivelContas: (p.result as { nivel?: number } | undefined)?.nivel ?? -1,
              });
              bd.close();
            };
            tx.onerror = () => reject(tx.error);
          };
          req.onerror = () => reject(req.error);
        }),
    );

  // o RegistrarServiceWorker recarrega a página quando o SW assume o controle
  // (controllerchange) — se o evaluate morrer nessa navegação, tenta de novo
  let banco: Awaited<ReturnType<typeof lerBanco>> | null = null;
  for (let tentativa = 0; tentativa < 3 && !banco; tentativa++) {
    try {
      banco = await lerBanco();
    } catch {
      await page.waitForTimeout(700);
      await expect(page.locator("[data-conta]")).toBeVisible();
    }
  }
  expect(banco, "não conseguiu ler o banco após o reload do SW").not.toBeNull();
  banco = banco!;
  expect(banco.versao).toBe(6);
  expect(banco.sentinela, "desenho da galeria sumiu no upgrade").toBe(true);
  expect(banco.nivelContas, "progresso antigo sumiu no upgrade").toBe(4);
  expect(banco.lojas).toEqual([
    "atelie",
    "caca",
    "cobras",
    "contas",
    "damas",
    "estados",
    "forca",
    "fracoes",
    "genius",
    "labirinto",
    "lig4",
    "lojinha",
    "ludo",
    "mancala",
    "memoria",
    "palavras",
    "perfis",
    "relogio",
    "rota",
    "tangram",
  ]);
});
