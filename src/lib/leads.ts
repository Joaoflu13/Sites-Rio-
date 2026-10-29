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

/**
 * Celular brasileiro normalizado (DDD + 9 + 8 dígitos) ou null se for fixo/inválido.
 * Fixo começa com 2–5 depois do DDD e não tem WhatsApp (salvo exceção rara).
 * O cadastro da RFB guarda muito celular antigo sem o 9º dígito (DDD + 8, começando
 * com 6–9): esses ganham o 9 na frente.
 */
export function normalizeMobile(phone: string): string | null {
  let d = phone.replace(/\D/g, "");
  if (d.length >= 12 && d.startsWith("55")) d = d.slice(2);
  if (d.length === 11 && d[2] === "9") return d;
  if (d.length === 10 && /[6-9]/.test(d[2])) return `${d.slice(0, 2)}9${d.slice(2)}`;
  return null;
}

/** Link de WhatsApp do primeiro celular entre os telefones dados (fixos são pulados). */
export function whatsappUrl(...phones: string[]): string | null {
  for (const p of phones) {
    const m = normalizeMobile(p ?? "");
    if (m) return `https://wa.me/55${m}`;
  }
  return null;
}

/** "Fixo" ou "Celular" para exibir ao lado do número. */
export function phoneKind(phone: string): "Celular" | "Fixo" {
  return normalizeMobile(phone) ? "Celular" : "Fixo";
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
