// Filtros e rótulos da fila de prospecção. Ferramenta interna: a equipe vê os
// dados completos dos estabelecimentos (dados públicos de PJ da RFB — LGPD ok
// para prospecção B2B; manter o canal de remoção documentado no README).

import type { Business, Prisma } from "@prisma/client";

export type LeadFilters = {
  bairro?: string;
  group?: string;
  presence?: string;
  minScore?: number;
  q?: string; // busca por nome
};

export const PRESENCE_LABEL: Record<string, string> = {
  UNKNOWN: "Não verificado",
  NO_SITE: "Sem site",
  SOCIAL_ONLY: "Só rede social",
  AGGREGATOR_ONLY: "Só agregador",
  HAS_SITE: "Tem site",
};

export const STATUS_LABEL: Record<string, string> = {
  NOVO: "Novo",
  CONTATADO: "Contatado",
  NEGOCIANDO: "Negociando",
  FECHADO: "Fechado",
  DESCARTADO: "Descartado",
};

const PRESENCE_VALUES = new Set(Object.keys(PRESENCE_LABEL));

/** Monta o where do Prisma a partir dos filtros da query string. */
export function buildLeadWhere(f: LeadFilters): Prisma.BusinessWhereInput {
  const where: Prisma.BusinessWhereInput = {};
  if (f.bairro) where.bairro = { equals: f.bairro, mode: "insensitive" };
  if (f.group) where.cnae = { group: f.group };
  if (f.presence && PRESENCE_VALUES.has(f.presence)) {
    where.presenceClass = f.presence as Business["presenceClass"];
  }
  if (f.minScore) where.score = { gte: f.minScore };
  if (f.q) where.displayName = { contains: f.q, mode: "insensitive" };
  return where;
}

/** Link de WhatsApp para um telefone brasileiro (ddd+numero, só dígitos). */
export function whatsappUrl(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return null; // fixo sem DDD etc.
  return `https://wa.me/55${digits}`;
}

/** Formata "21999998888" -> "(21) 99999-8888" para exibição. */
export function formatPhone(phone: string): string {
  const d = phone.replace(/\D/g, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return phone;
}
