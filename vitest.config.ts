import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    // Só lógica pura aqui. O que depende de canvas, toque e IndexedDB é
    // verificado no navegador de verdade, em tests/e2e.
    include: ["tests/unidade/**/*.test.ts"],
    environment: "node",
  },
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname) },
  },
});
