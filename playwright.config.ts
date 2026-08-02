import { defineConfig, devices } from "@playwright/test";

/**
 * E2E do Ateliê: sempre em viewport de celular, porque é o único jeito de a
 * criança usar o app. O servidor de produção é usado (não o dev) para que o
 * service worker e o build real entrem no teste.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3006",
    // jogador pré-escolhido: os specs testam o app JOGANDO; a tela de escolha
    // tem spec próprio (jogador.spec.ts) que limpa esta chave
    storageState: {
      cookies: [],
      origins: [
        {
          origin: "http://localhost:3006",
          localStorage: [{ name: "manu:jogador", value: "manuela" }],
        },
      ],
    },
  },
  projects: [
    {
      name: "android",
      use: { ...devices["Pixel 7"], isMobile: true, hasTouch: true },
    },
    {
      // O público vai abrir isto no Safari do iPhone: WebKit não é opcional.
      name: "iphone",
      use: { ...devices["iPhone 13"], isMobile: true, hasTouch: true },
    },
  ],
  webServer: {
    command: "bun run build && bun run start -p 3006",
    url: "http://localhost:3006",
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
