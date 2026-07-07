"use client";

import { useState } from "react";

/** Botão que copia a mensagem de abordagem (com o link da demo) para a área de transferência. */
export default function CopyPitch({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // http/clipboard bloqueado: fallback via textarea temporária
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <button type="button" className="btn btn--sm" onClick={copy}>
      {copied ? "Copiado ✓" : "Copiar abordagem"}
    </button>
  );
}
