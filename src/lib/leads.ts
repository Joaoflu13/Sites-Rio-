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
  WEAK_SITE: "Site grátis/fraco",
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

// Retorno combinado ("próximo contato"): o usuário escolhe só a DATA; guardamos
// meio-dia de Brasília (15:00 UTC) para a data não "pular" de dia com fuso.
// Brasil sem horário de verão desde 2019 → UTC-3 fixo.
const BRT_OFFSET_MS = 3 * 60 * 60 * 1000;

/** "2026-11-03" -> Date (meio-dia BRT). Vazio/ inválido -> null. */
export function parseFollowUpDate(raw: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const d = new Date(`${raw}T15:00:00.000Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== raw ? null : d;
}

/** Date -> "2026-11-03" (valor do <input type="date">), no fuso de Brasília. */
export function followUpInputValue(d: Date | null | undefined): string {
  return d ? new Date(d.getTime() - BRT_OFFSET_MS).toISOString().slice(0, 10) : "";
}

/** Último instante de "hoje" em Brasília: retornos até aqui estão vencidos/do dia. */
export function endOfTodayBRT(now: Date = new Date()): Date {
  const today = new Date(now.getTime() - BRT_OFFSET_MS).toISOString().slice(0, 10);
  return new Date(new Date(`${today}T23:59:59.999Z`).getTime() + BRT_OFFSET_MS);
}
