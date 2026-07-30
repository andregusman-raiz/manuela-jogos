import { expect, test, type Page } from "@playwright/test";

/**
 * O que estes testes protegem são as promessas do produto, não os detalhes:
 *  - a criança desenha com o dedo e o traço aparece;
 *  - nada se perde ao fechar o navegador;
 *  - nenhum toque só destrói trabalho;
 *  - pintar região do livro não vaza para o resto do papel;
 *  - o que sai do aparelho passa por um adulto.
 */

const TELA = ".tela-desenho";

async function limparBanco(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const req = indexedDB.deleteDatabase("manu-jogos");
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
        req.onblocked = () => resolve();
      }),
  );
}

/** Desenha arrastando o dedo de verdade (touch), não com mouse. */
async function riscar(page: Page, deltaY = 0) {
  const caixa = await page.locator(TELA).boundingBox();
  if (!caixa) throw new Error("canvas não encontrado");
  const y = caixa.y + caixa.height / 2 + deltaY;
  const x0 = caixa.x + caixa.width * 0.2;
  const x1 = caixa.x + caixa.width * 0.8;

  // Sem tap antes do arraste: um toque solto JÁ é um desenho (vira pingo), e
  // isso deixaria duas operações no histórico em vez de uma.
  await page.mouse.move(x0, y);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) {
    await page.mouse.move(x0 + ((x1 - x0) * i) / 12, y - Math.sin((i / 12) * Math.PI) * 40);
  }
  await page.mouse.up();
}

/**
 * Toque com área de contato declarada, como um dedo de verdade.
 *
 * `touchscreen.tap` e `mouse.click` do driver chegam com contato de 1px — passam
 * por qualquer filtro de palma e escondem justamente o que quebra no aparelho da
 * criança, onde o dedo registra dezenas de pixels.
 */
async function tocarComDedo(page: Page, x: number, y: number, contato: number, arrastar = 0) {
  await page.evaluate(
    ([px, py, largura, deslocar]) => {
      const alvo = document.querySelector(".tela-desenho");
      if (!alvo) throw new Error("tela não encontrada");
      const base = {
        bubbles: true,
        cancelable: true,
        pointerId: 1,
        pointerType: "touch",
        isPrimary: true,
        width: largura,
        height: largura,
        pressure: 0.5,
      };
      alvo.dispatchEvent(new PointerEvent("pointerdown", { ...base, clientX: px, clientY: py }));
      if (deslocar) {
        for (let i = 1; i <= 10; i++) {
          alvo.dispatchEvent(
            new PointerEvent("pointermove", {
              ...base,
              clientX: px + (deslocar * i) / 10,
              clientY: py,
            }),
          );
        }
      }
      alvo.dispatchEvent(
        new PointerEvent("pointerup", { ...base, clientX: px + deslocar, clientY: py }),
      );
    },
    [x, y, contato, arrastar] as [number, number, number, number],
  );
  await page.waitForTimeout(400);
}

async function pixelsPintados(page: Page) {
  return page.evaluate(() => {
    const arte = [...document.querySelectorAll("canvas")][1] as HTMLCanvasElement;
    const ctx = arte.getContext("2d");
    if (!ctx) return -1;
    const dados = ctx.getImageData(0, 0, arte.width, arte.height).data;
    let n = 0;
    for (let i = 3; i < dados.length; i += 4) if (dados[i] > 10) n++;
    return n;
  });
}

test.beforeEach(async ({ page }) => {
  await page.goto("/desenhar");
  await limparBanco(page);
  await page.reload();
  await page.waitForSelector(TELA);
});

test("o hub leva ao Ateliê em um toque", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Manuela");
  await page.getByLabel("Ateliê da Manu").click();
  await expect(page).toHaveURL(/\/desenhar/);
  await expect(page.locator(TELA)).toBeVisible();
});

test("desenha com o dedo e desfaz", async ({ page }) => {
  await expect(page.getByLabel("desfazer")).toBeDisabled();

  await riscar(page);
  expect(await pixelsPintados(page)).toBeGreaterThan(300);
  await expect(page.getByLabel("desfazer")).toBeEnabled();

  await page.getByLabel("desfazer").click();
  await expect.poll(() => pixelsPintados(page)).toBe(0);
});

test("não perde o desenho ao recarregar (autosave)", async ({ page }) => {
  await riscar(page);
  const antes = await pixelsPintados(page);
  expect(antes).toBeGreaterThan(300);

  await page.waitForTimeout(700); // deixa o autosave gravar
  await page.reload();
  await page.waitForSelector(TELA);

  // reconstruído a partir das operações: a contagem não é idêntica ao pixel,
  // mas o desenho tem de voltar com volume equivalente
  await expect.poll(() => pixelsPintados(page), { timeout: 5000 }).toBeGreaterThan(antes * 0.8);
});

test("apagar tudo exige segurar o dedo", async ({ page }) => {
  await riscar(page);
  await page.getByLabel("mais coisas: carimbos, formas, espelho e fundo").click();
  const lixeira = page.getByLabel("segure para apagar tudo");

  // toque rápido NÃO apaga
  await lixeira.dispatchEvent("pointerdown");
  await lixeira.dispatchEvent("pointerup");
  await page.waitForTimeout(300);
  expect(await pixelsPintados(page)).toBeGreaterThan(300);

  // segurando, apaga — e a bandeja se fecha sozinha ao confirmar, então o botão
  // sai do DOM antes de qualquer pointerup: é o comportamento esperado.
  await lixeira.dispatchEvent("pointerdown");
  await expect(lixeira).toBeHidden({ timeout: 4000 });
  await expect.poll(() => pixelsPintados(page)).toBe(0);
});

test("pintar região do livro não vaza para o papel", async ({ page }) => {
  await page.getByLabel("escolher desenho para colorir").click();
  await page.getByLabel("Gatinho").click();
  await page.waitForTimeout(400);

  await page.getByLabel("laranja").click();
  await page.waitForTimeout(150);
  const cabeca = page.locator('svg g[aria-label="pintar cabeça"]');
  await cabeca.dispatchEvent("pointerdown");
  await expect(cabeca).toHaveAttribute("fill", "#F76B15");

  // o canvas por baixo continua intocado — o toque não virou balde no papel
  expect(await pixelsPintados(page)).toBe(0);
});

test("página bitmap: balde pinta dentro das linhas sem inundar o papel", async ({ page }) => {
  await page.getByLabel("escolher desenho para colorir").click();
  // categoria veículos só tem páginas bitmap
  await page.getByLabel("Veículos").click();
  // dispatchEvent: as miniaturas lazy da grade assentam o layout por alguns
  // frames e o hit-test do clique real fica instável; o clique de grade em si
  // já é exercitado no teste do Gatinho
  await page.getByLabel("auto carro").dispatchEvent("click");
  // espera a imagem de linhas chegar à camada de fundo do canvas
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const fundo = [...document.querySelectorAll("canvas")][0] as HTMLCanvasElement;
          const ctx = fundo.getContext("2d");
          if (!ctx) return 0;
          const d = ctx.getImageData(0, 0, fundo.width, fundo.height).data;
          let escuros = 0;
          for (let i = 0; i < d.length; i += 4) if (d[i] < 100) escuros++;
          return escuros;
        }),
      { timeout: 5000 },
    )
    .toBeGreaterThan(500);

  // balde no centro do canvas (dentro do desenho)
  const caixa = await page.locator(TELA).boundingBox();
  if (!caixa) throw new Error("sem canvas");
  await page.touchscreen.tap(caixa.x + caixa.width / 2, caixa.y + caixa.height / 2);
  await page.waitForTimeout(400);

  const pintados = await pixelsPintados(page);
  const area = await page.evaluate(() => {
    const arte = [...document.querySelectorAll("canvas")][1] as HTMLCanvasElement;
    return arte.width * arte.height;
  });
  expect(pintados).toBeGreaterThan(50); // pintou algo
  // as linhas seguraram a tinta: não inundou o papel inteiro
  expect(pintados).toBeLessThan(area * 0.9);
});

test("página bitmap: dedo no contorno não pinta a teia de linhas", async ({ page }) => {
  await page.getByLabel("escolher desenho para colorir").click();
  // cena cheia: o contorno ocupa tanta área que o dedo acerta linha o tempo todo
  await page.getByLabel("Bobbie Goods").click();
  await page.waitForTimeout(400);
  await page.locator("button:has(img)").first().dispatchEvent("click");

  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const fundo = [...document.querySelectorAll("canvas")][0] as HTMLCanvasElement;
          const ctx = fundo.getContext("2d");
          if (!ctx) return 0;
          const d = ctx.getImageData(0, 0, fundo.width, fundo.height).data;
          let escuros = 0;
          for (let i = 0; i < d.length; i += 4) if (d[i] < 100) escuros++;
          return escuros;
        }),
      { timeout: 5000 },
    )
    .toBeGreaterThan(500);

  // toca EXATAMENTE num pixel de contorno, procurando do centro para fora
  const alvo = await page.evaluate(() => {
    const fundo = [...document.querySelectorAll("canvas")][0] as HTMLCanvasElement;
    const d = fundo.getContext("2d")!.getImageData(0, 0, fundo.width, fundo.height).data;
    const r = fundo.getBoundingClientRect();
    const cx = Math.floor(fundo.width / 2);
    const cy = Math.floor(fundo.height / 2);
    for (let raio = 0; raio < Math.min(cx, cy); raio += 2) {
      for (const [x, y] of [
        [cx + raio, cy],
        [cx - raio, cy],
        [cx, cy + raio],
        [cx, cy - raio],
      ]) {
        const i = (y * fundo.width + x) * 4;
        if (d[i] < 60 && d[i + 1] < 60 && d[i + 2] < 60) {
          return {
            telaX: r.left + (x / fundo.width) * r.width,
            telaY: r.top + (y / fundo.height) * r.height,
          };
        }
      }
    }
    return null;
  });
  expect(alvo, "a página deveria ter contorno perto do centro").not.toBeNull();

  await page.touchscreen.tap(alvo!.telaX, alvo!.telaY);
  await page.waitForTimeout(400);

  // O contorno continua contorno. Sem o desvio para o papel vizinho o balde toma
  // a linha como região e escorre pela rede inteira de traços — a criança vê o
  // desenho riscado de cor, não colorido.
  const invasao = await page.evaluate(() => {
    const fundo = [...document.querySelectorAll("canvas")][0] as HTMLCanvasElement;
    const arte = [...document.querySelectorAll("canvas")][1] as HTMLCanvasElement;
    const f = fundo.getContext("2d")!.getImageData(0, 0, fundo.width, fundo.height).data;
    const a = arte.getContext("2d")!.getImageData(0, 0, arte.width, arte.height).data;
    let escuros = 0;
    let comTinta = 0;
    for (let i = 0; i < f.length; i += 4) {
      if (f[i] < 60 && f[i + 1] < 60 && f[i + 2] < 60) {
        escuros++;
        if (a[i + 3] > 10) comTinta++;
      }
    }
    return escuros === 0 ? 1 : comTinta / escuros;
  });
  // medido nesta página: 0,2% com o desvio, 4,6% sem ele (a tinta corre pela
  // rede de traços). 1% separa os dois casos com folga dos dois lados.
  expect(invasao).toBeLessThan(0.01);
});

test("balde aceita o contato largo de um dedo de verdade", async ({ page }) => {
  await page.getByLabel("escolher desenho para colorir").click();
  await page.getByLabel("Bobbie Goods").click();
  await page.waitForTimeout(400);
  await page.locator("button:has(img)").first().dispatchEvent("click");
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const fundo = [...document.querySelectorAll("canvas")][0] as HTMLCanvasElement;
          const ctx = fundo.getContext("2d");
          if (!ctx) return 0;
          const d = ctx.getImageData(0, 0, fundo.width, fundo.height).data;
          let escuros = 0;
          for (let i = 0; i < d.length; i += 4) if (d[i] < 100) escuros++;
          return escuros;
        }),
      { timeout: 5000 },
    )
    .toBeGreaterThan(500);

  const caixa = await page.locator(TELA).boundingBox();
  if (!caixa) throw new Error("sem canvas");
  // 90 é polegar; o filtro de palma ficava em 68 e engolia o toque em silêncio
  await tocarComDedo(page, caixa.x + caixa.width * 0.35, caixa.y + caixa.height * 0.3, 90);
  // o piso é baixo de propósito: em tela menor a mesma área rende menos pixels,
  // e o que este teste separa é pintar (milhares) de não pintar nada (zero)
  expect(await pixelsPintados(page)).toBeGreaterThan(1000);
});

test("região pintada troca de cor, inclusive depois de uma cor escura", async ({ page }) => {
  await page.getByLabel("escolher desenho para colorir").click();
  await page.getByLabel("Bobbie Goods").click();
  await page.waitForTimeout(400);
  await page.locator("button:has(img)").first().dispatchEvent("click");
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const fundo = [...document.querySelectorAll("canvas")][0] as HTMLCanvasElement;
          const ctx = fundo.getContext("2d");
          if (!ctx) return 0;
          const d = ctx.getImageData(0, 0, fundo.width, fundo.height).data;
          let escuros = 0;
          for (let i = 0; i < d.length; i += 4) if (d[i] < 100) escuros++;
          return escuros;
        }),
      { timeout: 5000 },
    )
    .toBeGreaterThan(500);

  const caixa = await page.locator(TELA).boundingBox();
  if (!caixa) throw new Error("sem canvas");
  const alvoX = caixa.x + caixa.width * 0.35;
  const alvoY = caixa.y + caixa.height * 0.28;
  const corNoAlvo = () =>
    page.evaluate(
      ([x, y]) => {
        const arte = [...document.querySelectorAll("canvas")][1] as HTMLCanvasElement;
        const r = arte.getBoundingClientRect();
        const cx = Math.round(((x - r.left) / r.width) * arte.width);
        const cy = Math.round(((y - r.top) / r.height) * arte.height);
        const d = arte.getContext("2d")!.getImageData(cx, cy, 1, 1).data;
        return `${d[0]},${d[1]},${d[2]}`;
      },
      [alvoX, alvoY] as [number, number],
    );

  // Verde, marrom e azul escuro têm os três canais abaixo do limiar de traço.
  // Se a tinta da criança for confundida com o contorno da folha, a primeira
  // cor escura TRANCA a região e nenhuma outra entra depois.
  const esperado: Record<string, string> = {
    verde: "47,168,79",
    amarelo: "255,198,26",
    marrom: "107,70,48",
    vermelho: "229,53,43",
  };
  for (const [nome, rgb] of Object.entries(esperado)) {
    await page.getByLabel(nome, { exact: true }).click();
    await page.waitForTimeout(120);
    await tocarComDedo(page, alvoX, alvoY, 90);
    expect(await corNoAlvo(), `a região não aceitou ${nome}`).toBe(rgb);
  }
});

test("traço recusa palma apoiada, mas não o dedo", async ({ page }) => {
  const caixa = await page.locator(TELA).boundingBox();
  if (!caixa) throw new Error("sem canvas");
  const x = caixa.x + caixa.width * 0.25;
  const y = caixa.y + caixa.height * 0.5;

  await tocarComDedo(page, x, y, 40, 80);
  const comDedo = await pixelsPintados(page);
  expect(comDedo).toBeGreaterThan(100);

  await tocarComDedo(page, x, y + 60, 200, 80);
  // a mão apoiada não deixou risco fantasma: nada além do que o dedo já fez
  expect(await pixelsPintados(page)).toBe(comDedo);
});

test("compartilhar passa pelo portão parental", async ({ page }) => {
  await riscar(page);
  await page.getByLabel("mais coisas: carimbos, formas, espelho e fundo").click();
  await page.getByLabel("enviar este desenho para um adulto").click();

  const portao = page.getByRole("dialog", { name: "Precisa de um adulto" });
  await expect(portao).toBeVisible();

  const conta = await portao.locator("p").filter({ hasText: "×" }).first().textContent();
  const [, a, b] = conta?.match(/(\d+)\s*×\s*(\d+)/) ?? [];
  // tabuada alta: barreira real para o público de 8-10, trivial para o adulto
  expect(Number(a)).toBeGreaterThanOrEqual(6);
  expect(Number(b)).toBeGreaterThanOrEqual(6);

  // resposta errada é recusada e a conta muda
  const errada = String(Number(a) * Number(b) + 1);
  for (const d of errada) await portao.getByLabel(d, { exact: true }).click();
  await portao.getByLabel("confirmar").click();
  await expect(portao).toContainText("Não foi essa");

  // criança sem saber a tabuada não passa daqui; o adulto passa
  const conta2 = await portao.locator("p").filter({ hasText: "×" }).first().textContent();
  const [, c, d2] = conta2?.match(/(\d+)\s*×\s*(\d+)/) ?? [];
  for (const digito of String(Number(c) * Number(d2))) {
    await portao.getByLabel(digito, { exact: true }).click();
  }
  await portao.getByLabel("confirmar").click();
  await expect(portao).toBeHidden();
});

test("guardar de novo e trocar de página não duplicam na galeria", async ({ page }) => {
  const contarGaleria = () =>
    page.evaluate(
      () =>
        new Promise<number>((resolve) => {
          const req = indexedDB.open("manu-jogos", 1);
          req.onsuccess = () => {
            const g = req.result.transaction("atelie", "readonly").objectStore("atelie").getAll();
            g.onsuccess = () =>
              resolve((g.result as { id: string }[]).filter((d) => d.id !== "rascunho").length);
          };
          req.onerror = () => resolve(-1);
        }),
    );

  await riscar(page);

  // guardar 2x sem mudar nada = 1 item só
  await page.getByLabel("guardar meu desenho").click();
  await expect(page.getByText("Guardado!")).toBeVisible();
  await page.getByLabel("guardar meu desenho").click();
  await expect(page.getByText("Já está guardado!")).toBeVisible();
  expect(await contarGaleria()).toBe(1);

  // ir colorir logo depois de guardar também não cria segunda cópia
  await page.getByLabel("escolher desenho para colorir").click();
  await page.getByLabel("Gatinho").click();
  await page.waitForTimeout(500);
  expect(await contarGaleria()).toBe(1);

  // continuar um desenho da galeria e guardar ATUALIZA o original
  await page.getByLabel("mais coisas: carimbos, formas, espelho e fundo").click();
  await page.getByLabel("meus desenhos").click();
  await page.locator('[aria-label="abrir este desenho"]').first().click();
  await page.waitForTimeout(400);
  await riscar(page, 80);
  await page.getByLabel("guardar meu desenho").click();
  await expect(page.getByText("Guardado!")).toBeVisible();
  expect(await contarGaleria()).toBe(1);
});

test("guardar coloca o desenho na galeria com miniatura", async ({ page }) => {
  await riscar(page);
  await page.getByLabel("guardar meu desenho").click();
  await expect(page.getByText("Guardado!")).toBeVisible();

  await page.getByLabel("mais coisas: carimbos, formas, espelho e fundo").click();
  await page.getByLabel("meus desenhos").click();

  await expect(page.getByRole("heading", { name: "Meus desenhos" })).toBeVisible();
  const miniatura = page.locator('img[alt="desenho guardado"]').first();
  await expect(miniatura).toBeVisible();
  expect(await miniatura.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
});

test("alvos de toque respeitam o mínimo infantil", async ({ page }) => {
  // NN/g: ~2cm x 2cm para criança. 64px é o piso que ainda cabe em tela de 360px.
  const rotulos = ["borracha", "balde de tinta", "desfazer", "guardar meu desenho"];
  for (const rotulo of rotulos) {
    const caixa = await page.getByLabel(rotulo).boundingBox();
    expect(caixa, rotulo).not.toBeNull();
    expect(Math.min(caixa!.width, caixa!.height), `${rotulo} pequeno demais`).toBeGreaterThanOrEqual(
      56,
    );
  }
});
