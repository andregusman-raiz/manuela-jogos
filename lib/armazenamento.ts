import type { Desenho } from "./desenho/tipos";

/**
 * Guarda tudo no aparelho (IndexedDB). Nenhum dado sai daqui: não há conta,
 * servidor nem analytics no app.
 *
 * Duas gavetas:
 *   rascunho — o desenho em andamento, salvo a cada traço. É o que garante que
 *              fechar o navegador no meio nunca perde nada.
 *   galeria  — os desenhos que a criança guardou, com miniatura.
 *
 * Sem biblioteca de wrapper: são cinco operações e um `openDB` — dependência
 * aqui só aumentaria o bundle que precisa abrir em 3s no 4G.
 */

const NOME_BD = "manu-jogos";
const VERSAO_BD = 1;
/** Uma gaveta por jogo: o próximo jogo do hub não colide com o Ateliê. */
const LOJA_ATELIE = "atelie";
const ID_RASCUNHO = "rascunho";

function suportado(): boolean {
  return typeof indexedDB !== "undefined";
}

function abrir(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const pedido = indexedDB.open(NOME_BD, VERSAO_BD);
    pedido.onupgradeneeded = () => {
      const bd = pedido.result;
      if (!bd.objectStoreNames.contains(LOJA_ATELIE)) {
        const loja = bd.createObjectStore(LOJA_ATELIE, { keyPath: "id" });
        loja.createIndex("atualizadoEm", "atualizadoEm");
      }
    };
    pedido.onsuccess = () => resolve(pedido.result);
    pedido.onerror = () => reject(pedido.error);
  });
}

async function comLoja<T>(
  modo: IDBTransactionMode,
  acao: (loja: IDBObjectStore) => IDBRequest<T>,
): Promise<T | null> {
  if (!suportado()) return null;
  try {
    const bd = await abrir();
    return await new Promise<T | null>((resolve, reject) => {
      const tx = bd.transaction(LOJA_ATELIE, modo);
      const pedido = acao(tx.objectStore(LOJA_ATELIE));
      pedido.onsuccess = () => resolve(pedido.result);
      pedido.onerror = () => reject(pedido.error);
      tx.oncomplete = () => bd.close();
    });
  } catch {
    // Modo privado / cota cheia: o app continua desenhando, só não persiste.
    return null;
  }
}

export async function salvarRascunho(desenho: Desenho): Promise<void> {
  await comLoja("readwrite", (loja) => loja.put({ ...desenho, id: ID_RASCUNHO }));
}

export async function carregarRascunho(): Promise<Desenho | null> {
  const r = await comLoja<Desenho>("readonly", (loja) => loja.get(ID_RASCUNHO));
  return r ?? null;
}

export async function apagarRascunho(): Promise<void> {
  await comLoja("readwrite", (loja) => loja.delete(ID_RASCUNHO));
}

export async function guardarNaGaleria(desenho: Desenho): Promise<string> {
  const id = `d-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  await comLoja("readwrite", (loja) => loja.put({ ...desenho, id }));
  return id;
}

export async function listarGaleria(): Promise<Desenho[]> {
  const todos = await comLoja<Desenho[]>("readonly", (loja) => loja.getAll());
  if (!todos) return [];
  return todos
    .filter((d) => d.id !== ID_RASCUNHO)
    .sort((a, b) => b.atualizadoEm - a.atualizadoEm);
}

export async function apagarDaGaleria(id: string): Promise<void> {
  if (id === ID_RASCUNHO) return;
  await comLoja("readwrite", (loja) => loja.delete(id));
}

export async function buscarDesenho(id: string): Promise<Desenho | null> {
  const r = await comLoja<Desenho>("readonly", (loja) => loja.get(id));
  return r ?? null;
}
