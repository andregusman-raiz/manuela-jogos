/* Service worker do Manuela Jogos — offline-first.
 *
 * Por que escrito à mão em vez de next-pwa/serwist: o app é pequeno e sem
 * backend, e o que precisamos é simples — depois da primeira visita tudo abre
 * sem rede (carro, viagem, escola sem wi-fi). Uma dependência de build a mais
 * não pagaria o custo.
 *
 * Estratégias:
 *   navegação      -> rede primeiro, cache no fallback (nunca "sem internet")
 *   /_next/static  -> cache primeiro (nomes com hash: imutáveis)
 *   assets nossos  -> cache primeiro (manu/, colorir/, ícones)
 *   RSC (?_rsc=)   -> rede primeiro (é código de tela, não asset)
 *   resto          -> stale-while-revalidate
 */

// Subir esta versão APAGA os caches antigos no aparelho (ver "activate"). É o
// que destrava um aparelho preso numa versão velha do app.
const VERSAO = "v17";
const CACHE_APP = `manu-app-${VERSAO}`;
const CACHE_ASSETS = `manu-assets-${VERSAO}`;

// Casca mínima para o app abrir offline logo depois da instalação.
const CASCA = [
  "/",
  "/desenhar",
  "/contas",
  "/memoria",
  "/labirinto",
  "/palavras",
  "/forca",
  "/relogio",
  "/lojinha",
  "/genius",
  "/fracoes",
  "/estados",
  "/tangram",
  "/damas",
  "/caca",
  "/ludo",
  "/cobras",
  "/manifest.webmanifest",
  "/manu/manu-corpo.webp",
  "/manu/manu-avatar.webp",
  "/manu/icon-192.png",
  "/manu/icon-512.png",
];

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_APP);
      // addAll falha inteiro se um item falhar; adicionamos um a um para que
      // um asset ausente não impeça a instalação do service worker.
      await Promise.all(
        CASCA.map((url) => cache.add(new Request(url, { cache: "reload" })).catch(() => {})),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    (async () => {
      const nomes = await caches.keys();
      await Promise.all(
        nomes
          .filter((n) => n.startsWith("manu-") && n !== CACHE_APP && n !== CACHE_ASSETS)
          .map((n) => caches.delete(n)),
      );
      await self.clients.claim();
    })(),
  );
});

async function cachePrimeiro(pedido, nomeCache) {
  const cache = await caches.open(nomeCache);
  const salvo = await cache.match(pedido);
  if (salvo) return salvo;
  const resposta = await fetch(pedido);
  if (resposta.ok) cache.put(pedido, resposta.clone());
  return resposta;
}

async function redePrimeiro(pedido) {
  const cache = await caches.open(CACHE_APP);
  try {
    const resposta = await fetch(pedido);
    if (resposta.ok) cache.put(pedido, resposta.clone());
    return resposta;
  } catch {
    const salvo = (await cache.match(pedido)) || (await cache.match("/"));
    if (salvo) return salvo;
    throw new Error("offline e sem cache");
  }
}

async function revalidandoDepois(pedido) {
  const cache = await caches.open(CACHE_ASSETS);
  const salvo = await cache.match(pedido);
  const rede = fetch(pedido)
    .then((resposta) => {
      if (resposta.ok) cache.put(pedido, resposta.clone());
      return resposta;
    })
    .catch(() => null);
  return salvo || (await rede) || Response.error();
}

self.addEventListener("fetch", (evento) => {
  const { request } = evento;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // não mexemos em terceiros

  if (request.mode === "navigate") {
    evento.respondWith(redePrimeiro(request));
    return;
  }

  // Payload de tela do Next (RSC), pedido ao tocar num link dentro do app. É
  // CÓDIGO da página, não asset: servir do cache faz o aparelho abrir a tela de
  // ontem depois de um deploy — quem entra pela home e navega clicando ficava
  // presa na versão com defeito, mesmo com a correção publicada.
  if (url.searchParams.has("_rsc") || request.headers.get("RSC") === "1") {
    evento.respondWith(redePrimeiro(request));
    return;
  }

  if (url.pathname.startsWith("/_next/static/")) {
    evento.respondWith(cachePrimeiro(request, CACHE_ASSETS));
    return;
  }

  if (
    url.pathname.startsWith("/manu/") ||
    url.pathname.startsWith("/colorir/") ||
    url.pathname.startsWith("/colorir-img/") ||
    url.pathname === "/manifest.webmanifest"
  ) {
    evento.respondWith(cachePrimeiro(request, CACHE_ASSETS));
    return;
  }

  evento.respondWith(revalidandoDepois(request));
});
