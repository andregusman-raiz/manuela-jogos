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

    const registrar = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // sem offline o app continua funcionando normalmente
      });
    };

    if (document.readyState === "complete") registrar();
    else window.addEventListener("load", registrar, { once: true });

    return () => window.removeEventListener("load", registrar);
  }, []);

  return null;
}
