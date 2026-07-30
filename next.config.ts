import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // O workspace tem outros lockfiles acima desta pasta; sem isto o Turbopack
  // adivinha a raiz errada e avisa em todo build.
  turbopack: { root: import.meta.dirname },
  images: {
    // Os assets da Manuela já são WebP recortados no tamanho de uso. Servindo
    // direto de /manu/, o service worker consegue cacheá-los pelo caminho real
    // (o pipeline /_next/image geraria URLs que a casca offline não prevê).
    unoptimized: true,
  },
  async headers() {
    return [
      {
        // O service worker não pode ficar preso em cache: senão uma versão nova
        // do app nunca chega ao aparelho.
        source: "/sw.js",
        headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }],
      },
    ];
  },
};

export default nextConfig;
