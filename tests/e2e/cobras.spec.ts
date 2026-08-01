import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { aplicarDado, criarPartida, jogar } from "@/lib/cobras/motor";
import type { EstadoCobras } from "@/lib/cobras/motor";
import { criarDado } from "@/lib/dado";
import { tocarNoElemento } from "./_toque";

/**
 * Cobras e Escadas — SPEC §2.3. Espelho motor×DOM com a MESMA semente do LCG
 * (blocker J4) + oráculo de geometria boustrophedon no DOM (blocker J5).
 *
 * Semente 15 (escolhida offline): 2P, 42 rolagens, passa por 1 cobra e
 * 3 escadas antes de alguém chegar ao 100.
 */

const SEMENTE = 15;

async function entrar2Jogadores(page: Page) {
  await page.goto(`/cobras?semente=${SEMENTE}`);
  await tocarNoElemento(page.getByLabel("2 jogadores"));
  await expect(page.locator("[data-dado-botao]")).toBeVisible();
}

test("geometria boustrophedon: 1 embaixo-esquerda, linha 2 invertida, 100 no topo", async ({
  page,
}) => {
  await entrar2Jogadores(page);
  const caixa = async (casa: number) => {
    const c = await page.locator(`rect[data-casa="${casa}"]`).boundingBox();
    expect(c, `casa ${casa} sem caixa`).not.toBeNull();
    return c!;
  };
  const c1 = await caixa(1);
  const c10 = await caixa(10);
  const c11 = await caixa(11);
  const c20 = await caixa(20);
  const c21 = await caixa(21);
  const c100 = await caixa(100);

  expect(Math.abs(c1.y - c10.y)).toBeLessThan(2); // mesma linha de baixo
  expect(c10.x).toBeGreaterThan(c1.x); // linha 1 corre esq→dir
  expect(c11.y).toBeLessThan(c1.y - 2); // linha 2 é ACIMA
  expect(Math.abs(c11.x - c10.x)).toBeLessThan(2); // 11 na MESMA coluna do 10 (direita)
  expect(Math.abs(c20.x - c1.x)).toBeLessThan(2); // 20 termina na esquerda
  expect(Math.abs(c21.x - c1.x)).toBeLessThan(2); // linha 3 volta a começar na esquerda
  expect(c100.y).toBeLessThan(c21.y); // 100 lá no topo
  expect(Math.abs(c100.x - c1.x)).toBeLessThan(2); // ...à esquerda
});

test("partida 2P espelhada com o motor até o 100 — com cobra, escada e animação", async ({
  page,
}) => {
  test.setTimeout(240_000);
  await entrar2Jogadores(page);
  await expect(page.locator("main")).toHaveAttribute("data-semente", String(SEMENTE));

  const dado = criarDado(SEMENTE);
  let estado: EstadoCobras = criarPartida(2);
  let rolagens = 0;
  let vistoCobra = false;
  let vistoEscada = false;
  let vistoAnimacao = false;

  while (estado.situacao !== "fim" && rolagens < 100) {
    const d6 = dado();
    const jogada = aplicarDado(estado.posicoes[estado.vez], d6);
    if (jogada.atalho === "cobra") vistoCobra = true;
    if (jogada.atalho === "escada") vistoEscada = true;

    await expect(page.locator("[data-dado-botao]")).toBeEnabled({ timeout: 8000 });
    await tocarNoElemento(page.locator("[data-dado-botao]"));
    rolagens++;

    // a animação casa-a-casa precisa APARECER (SPEC §2.3)
    if (!vistoAnimacao && d6 >= 2) {
      await expect(page.locator("[data-vez]")).toHaveAttribute("data-animando", "true", {
        timeout: 2000,
      });
      vistoAnimacao = true;
    }

    estado = jogar(estado, d6);
    // espera a animação terminar e o DOM assentar no estado do motor
    await expect(page.locator("[data-vez]")).toHaveAttribute("data-animando", "false", {
      timeout: 8000,
    });
    for (const [jogador, pos] of estado.posicoes.entries()) {
      await expect(
        page.locator(`circle[data-peao="${jogador}"]`),
        `rolagem ${rolagens}, jogador ${jogador}`,
      ).toHaveAttribute("data-pos", String(pos));
    }
    if (estado.situacao !== "fim") {
      await expect(page.locator("[data-vez]")).toHaveAttribute("data-vez", String(estado.vez));
    }
  }

  expect(estado.situacao, "partida da semente 15 não terminou").toBe("fim");
  expect(vistoCobra, "a semente devia passar por uma cobra").toBe(true);
  expect(vistoEscada, "a semente devia passar por uma escada").toBe(true);
  await expect(page.locator("canvas[data-ativo='true']")).toBeAttached({ timeout: 5000 });
  await expect(page.getByText(/chegou no 100!/)).toBeVisible();
});

test("três formatos: tabuleiro inteiro e dado alcançável", async ({ browser }) => {
  const formatos = [
    { nome: "celular", viewport: { width: 390, height: 844 } },
    { nome: "tablet", viewport: { width: 820, height: 1180 } },
    { nome: "deitado", viewport: { width: 844, height: 390 } },
  ];
  for (const formato of formatos) {
    const contexto = await browser.newContext({ viewport: formato.viewport });
    const pagina = await contexto.newPage();
    await pagina.goto(`/cobras?semente=${SEMENTE}`);
    await tocarNoElemento(pagina.getByLabel("2 jogadores"));
    const tabuleiro = await pagina.getByLabel("tabuleiro de cobras e escadas").boundingBox();
    expect(tabuleiro, `${formato.nome}: sem tabuleiro`).not.toBeNull();
    expect(tabuleiro!.width, `${formato.nome}: tabuleiro colapsado`).toBeGreaterThan(200);
    expect(
      tabuleiro!.y + tabuleiro!.height,
      `${formato.nome}: tabuleiro cortado embaixo`,
    ).toBeLessThanOrEqual(formato.viewport.height + 1);
    const dadoBtn = await pagina.locator("[data-dado-botao]").boundingBox();
    expect(dadoBtn!.width, `${formato.nome}: dado < 44px`).toBeGreaterThanOrEqual(44);
    expect(
      dadoBtn!.y + dadoBtn!.height,
      `${formato.nome}: dado fora da tela`,
    ).toBeLessThanOrEqual(formato.viewport.height + 1);
    await contexto.close();
  }
});
