import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { criarDado } from "@/lib/dado";
import { criarPartida, jogadasLegais, mover, rolar } from "@/lib/ludo/motor";
import type { DadoLudo, EstadoLudo } from "@/lib/ludo/motor";
import { tocarNoElemento } from "./_toque";

/**
 * Ludo — SPEC-jogos-tabuleiro §1.6. A UI usa o LCG de lib/dado.ts com a
 * semente da URL; o teste recria o MESMO dado e re-executa o motor, comparando
 * o DOM rolagem a rolagem (blocker J4 do juiz: dados 100% reproduzíveis).
 *
 * Semente 13 (escolhida offline com o motor real): partida 2P nível 1 termina
 * em 67 rolagens e contém uma captura.
 */

const SEMENTE = 13;

async function entrar2Jogadores(page: Page) {
  await page.goto(`/ludo?semente=${SEMENTE}`);
  await tocarNoElemento(page.getByLabel("2 jogadores"));
  await expect(page.locator("[data-dado-botao]")).toBeVisible();
}

/** Toca o dado e espera a UI assentar (animação de 400ms + avisos de 900ms). */
async function rolarNaTela(page: Page) {
  await tocarNoElemento(page.locator("[data-dado-botao]"));
  await page.waitForTimeout(500);
}

async function estadoDoDom(page: Page) {
  const peoes = await page.locator("circle[data-peao]").evaluateAll((els) =>
    els.map((el) => ({
      peao: el.getAttribute("data-peao")!,
      progresso: Number(el.getAttribute("data-progresso")),
      area: el.getAttribute("data-area")!,
    })),
  );
  return Object.fromEntries(peoes.map((p) => [p.peao, p]));
}

test("partida 2P completa dirigida pelo motor — DOM confere rolagem a rolagem", async ({
  page,
}) => {
  test.setTimeout(240_000);
  await entrar2Jogadores(page);
  await expect(page.locator("main")).toHaveAttribute("data-semente", String(SEMENTE));

  const dado = criarDado(SEMENTE);
  let estado: EstadoLudo = criarPartida(2, 1);
  let capturas = 0;
  let rolagens = 0;

  while (estado.situacao !== "fim" && rolagens < 300) {
    // espelho: rola no motor e na tela com o MESMO dado
    const d6 = dado();
    estado = rolar(estado, d6 as DadoLudo);
    rolagens++;
    await rolarNaTela(page);

    while (estado.situacao === "mover") {
      const legais = jogadasLegais(estado);
      const indice = legais[0];
      const alvo = estado.peoes[indice];
      const proximo = mover(estado, indice);
      capturas += proximo.peoes.filter(
        (p, i) => p.progresso === -1 && estado.peoes[i].progresso >= 0,
      ).length;

      if (legais.length === 1) {
        await page.waitForTimeout(800); // auto-move da UI
      } else {
        await tocarNoElemento(page.locator(`[data-chip="${alvo.cor}-${alvo.indice}"]`));
        await page.waitForTimeout(250);
      }
      estado = proximo;
    }

    if (estado.situacao !== "fim") {
      // aviso de "passou a vez" segura a UI por ~900ms
      await page.waitForTimeout(300);
      const dom = await estadoDoDom(page);
      for (const p of estado.peoes) {
        const chave = `${p.cor}-${p.indice}`;
        expect(dom[chave]?.progresso, `rolagem ${rolagens}, peão ${chave}`).toBe(p.progresso);
      }
      await expect(page.locator("[data-vez]")).toHaveAttribute("data-vez", String(estado.vez));
    }
  }

  expect(estado.situacao, "partida da semente 13 não terminou em 300 rolagens").toBe("fim");
  expect(capturas, "a semente escolhida devia ter captura").toBeGreaterThan(0);
  await expect(page.locator("canvas[data-ativo='true']")).toBeAttached({ timeout: 5000 });
  await expect(page.getByText(/venceu!/)).toBeVisible();

  // persistência: vencer no nível 1 liberou o nível 2 (recarrega e confere)
  await page.goto(`/ludo?semente=${SEMENTE + 1}`);
  await expect(page.getByLabel("nível 2")).toBeVisible({ timeout: 5000 });
});

test("três formatos: tabuleiro e barra do dado inteiros na tela", async ({ browser }) => {
  const formatos = [
    { nome: "celular", viewport: { width: 390, height: 844 } },
    { nome: "tablet", viewport: { width: 820, height: 1180 } },
    { nome: "deitado", viewport: { width: 844, height: 390 } },
  ];
  for (const formato of formatos) {
    const contexto = await browser.newContext({ viewport: formato.viewport });
    const pagina = await contexto.newPage();
    await pagina.goto(`/ludo?semente=${SEMENTE}`);
    await tocarNoElemento(pagina.getByLabel("2 jogadores"));
    const tabuleiro = await pagina.getByLabel("tabuleiro de ludo").boundingBox();
    expect(tabuleiro, `${formato.nome}: sem tabuleiro`).not.toBeNull();
    expect(tabuleiro!.width, `${formato.nome}: tabuleiro colapsado`).toBeGreaterThan(200);
    const dado = await pagina.locator("[data-dado-botao]").boundingBox();
    expect(dado!.y + dado!.height, `${formato.nome}: dado fora da tela`).toBeLessThanOrEqual(
      formato.viewport.height + 1,
    );
    expect(dado!.width, `${formato.nome}: dado < 44px`).toBeGreaterThanOrEqual(44);
    await contexto.close();
  }
});
