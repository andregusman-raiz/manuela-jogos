/**
 * Descoberta do botão "mais coisas" (✨).
 *
 * Metade das ferramentas — inclusive a mandala, o maior "uau" do app — mora
 * atrás desse botão. Até a criança abri-lo pela primeira vez, ele pulsa de leve;
 * depois disso, para para sempre (persistido no aparelho). Exploração continua
 * sendo a regra: o pulse só encurta o caminho até a primeira descoberta.
 *
 * Mesmo desenho do mudo em som.ts: estado externo (localStorage) espelhado no
 * React via useSyncExternalStore.
 */

const CHAVE = "manu:descobriu-mais";

let descoberto = false;
let lido = false;
const ouvintes = new Set<() => void>();

export function assinarDescoberta(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte);
  return () => ouvintes.delete(ouvinte);
}

export function jaDescobriuMais(): boolean {
  if (typeof window === "undefined") return true;
  if (!lido) {
    try {
      descoberto = window.localStorage.getItem(CHAVE) === "1";
    } catch {
      descoberto = true; // sem storage, não insistir no pulse
    }
    lido = true;
  }
  return descoberto;
}

/** No servidor não há o que descobrir: renderiza sem pulse (evita flash). */
export function descobertaNoServidor(): boolean {
  return true;
}

export function marcarDescobriuMais(): void {
  if (descoberto) return;
  descoberto = true;
  lido = true;
  for (const ouvinte of ouvintes) ouvinte();
  try {
    window.localStorage.setItem(CHAVE, "1");
  } catch {
    // sem persistência: o pulse volta na próxima visita, sem prejuízo
  }
}
