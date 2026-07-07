// Slug público do site demo de um estabelecimento.
// Determinístico a partir do Business (não exige linha no banco):
//   slugify(displayName) + "-" + últimos 6 dígitos do CNPJ
// Ex.: "Padaria Estrela da Gávea" (cnpj ...000191) -> padaria-estrela-da-gavea-000191

import type { Business } from "@prisma/client";

const COMBINING_MARKS = new RegExp("[\\u0300-\\u036f]", "g");

/** "Padaria Estrela da Gávea" -> "padaria-estrela-da-gavea" */
export function slugify(name: string): string {
  const s = name
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
  return s || "estabelecimento";
}

/** Slug determinístico do site demo. */
export function demoSlug(b: Pick<Business, "displayName" | "cnpj">): string {
  return `${slugify(b.displayName)}-${b.cnpj.slice(-6)}`;
}

/** Extrai o sufixo de 6 dígitos do fim de um slug (ou null se não tem). */
export function slugSuffix(slug: string): string | null {
  const m = /-(\d{6})$/.exec(slug);
  return m ? m[1] : null;
}
