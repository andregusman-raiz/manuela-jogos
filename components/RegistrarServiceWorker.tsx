"use client";

import { useEffect } from "react";

/**
 * Registra o service worker (offline-first) depois que a página carrega, para
 * não competir com o primeiro render. Em dev fica desligado: service worker
 * cacheando build de desenvolvimento só gera confusão.
 */
export function RegistrarServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    /**
     * Já havia um service worker no comando: se outro assumir, é porque saiu
     * versão nova. A página em pé continuaria com o código antigo até a criança
     * fechar e abrir o app — e o aparelho fica preso numa versão com defeito
     * mesmo depois da correção publicada. Recarregar uma vez resolve.
     */
    const jaControlado = Boolean(navigator.serviceWorker.controller);
    let recarregando = false;
    const aoTrocarControlador = () => {
      if (!jaControlado || recarregando) return;
      recarregando = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", aoTrocarControlador);

    const registrar = () => {
      navigator.serviceWorker
        .register("/sw.js")
        // procura versão nova já na abertura, sem esperar o ciclo do navegador
        .then((reg) => reg.update().catch(() => {}))
        .catch(() => {
          // sem offline o app continua funcionando normalmente
        });
    };

    if (document.readyState === "complete") registrar();
    else window.addEventListener("load", registrar, { once: true });

    return () => {
      window.removeEventListener("load", registrar);
      navigator.serviceWorker.removeEventListener("controllerchange", aoTrocarControlador);
    };
  }, []);

  return null;
}
