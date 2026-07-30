import type { Locator } from "@playwright/test";

/**
 * Toque com área de contato de dedo real num ELEMENTO qualquer.
 *
 * O `tocarComDedo` do atelie.spec é acoplado à `.tela-desenho` e não emite
 * `click` — serve para o canvas, não para botões. Este helper é o genérico dos
 * jogos: `touchscreen.tap`/`mouse.click` do driver chegam com contato de 1px e
 * passam por qualquer filtro de palma, escondendo o que quebra no dedo da
 * criança (70-90px). BotaoBolha age no `onClick`, então além do par
 * pointerdown/pointerup despachamos o click sintético.
 */
export async function tocarNoElemento(alvo: Locator, contato = 80): Promise<void> {
  await alvo.evaluate((el, largura) => {
    const r = el.getBoundingClientRect();
    const cx = r.x + r.width / 2;
    const cy = r.y + r.height / 2;
    const base: PointerEventInit = {
      bubbles: true,
      cancelable: true,
      pointerId: 1,
      pointerType: "touch",
      isPrimary: true,
      width: largura,
      height: largura,
      pressure: 0.5,
      clientX: cx,
      clientY: cy,
    };
    el.dispatchEvent(new PointerEvent("pointerdown", base));
    el.dispatchEvent(new PointerEvent("pointerup", base));
    el.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true, clientX: cx, clientY: cy }),
    );
  }, contato);
  await alvo.page().waitForTimeout(150);
}
