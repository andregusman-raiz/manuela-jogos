import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Manuela Jogos",
    short_name: "Manu Jogos",
    description: "Jogos para brincar, desenhar e pintar. Feito para a Manuela.",
    lang: "pt-BR",
    start_url: "/",
    // standalone: abre sem barra de URL, como aplicativo de verdade.
    display: "standalone",
    orientation: "any",
    background_color: "#fff9f3",
    theme_color: "#fff9f3",
    icons: [
      { src: "/manu/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/manu/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/manu/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
