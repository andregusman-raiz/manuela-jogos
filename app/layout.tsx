import type { Metadata, Viewport } from "next";
import { Baloo_2, Nunito } from "next/font/google";
import "./globals.css";
import { RegistrarServiceWorker } from "@/components/RegistrarServiceWorker";

// next/font baixa e serve as fontes do nosso próprio domínio no build:
// nenhum request a CDN externo em runtime (privacidade + funciona offline).
const baloo = Baloo_2({
  variable: "--font-baloo",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Manuela Jogos",
  description: "Jogos para brincar, desenhar e pintar. Feito para a Manuela.",
  applicationName: "Manuela Jogos",
  appleWebApp: {
    capable: true,
    title: "Manuela Jogos",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/manu/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/manu/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/manu/apple-icon.png",
  },
  // App infantil: nada de indexação/robots é necessário, e não coletamos nada.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#fff9f3",
  width: "device-width",
  initialScale: 1,
  // Zoom da PÁGINA desligado de propósito: o zoom acidental de dois dedos
  // arruína o desenho. O zoom real acontece DENTRO do canvas, controlado.
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${baloo.variable} ${nunito.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        {children}
        <RegistrarServiceWorker />
      </body>
    </html>
  );
}
