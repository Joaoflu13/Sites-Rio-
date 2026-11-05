"use client";

import { useEffect } from "react";

/**
 * Avisa o CRM que alguém abriu a demo. Roda só no navegador: robôs de
 * pré-visualização de link (WhatsApp, Gmail, antivírus) não executam JS.
 */
export default function DemoBeacon({ slug, channel }: { slug: string; channel: string }) {
  useEffect(() => {
    const body = JSON.stringify({ slug, channel });
    try {
      if (!navigator.sendBeacon?.("/api/view", new Blob([body], { type: "application/json" }))) {
        void fetch("/api/view", { method: "POST", body, keepalive: true, headers: { "Content-Type": "application/json" } });
      }
    } catch {
      // rastreio nunca quebra a página
    }
  }, [slug, channel]);
  return null;
}
