// Consulta e serialização de leads.
//
// Política de dados (LGPD): componentes/actions só podem mandar ao cliente o
// resultado de toPreview() — sem CNPJ, endereço, telefone ou e-mail — a menos
// que exista LeadUnlock do usuário logado (aí vale toFull()). O export CSV e o
// painel admin usam toFull() atrás de requireAdmin.

import type { Business, CnaeCategory, Prisma } from "@prisma/client";
import { groupLabel } from "@/lib/cnae";

export type LeadFilters = {
  bairro?: string;
  group?: string;
  presence?: string; // PresenceClass ou "" (todos os verificados)
  minScore?: number;
};

export const PRESENCE_LABEL: Record<string, string> = {
  UNKNOWN: "Não verificado",
  NO_SITE: "Sem site",
  SOCIAL_ONLY: "Só rede social",
  AGGREGATOR_ONLY: "Só agregador",
  HAS_SITE: "Tem site",
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
  return where;
}

/** "Padaria Estrela da Gávea" -> "Padaria E██████ ██ █████" (1º token visível). */
export function maskName(displayName: string): string {
  const name = displayName.trim();
  if (!name) return "█████";
  const tokens = name.split(/\s+/);
  if (tokens.length === 1) {
    return name.slice(0, 2) + "█".repeat(Math.max(name.length - 2, 3));
  }
  const rest = tokens
    .slice(1)
    .map((t, i) => (i === 0 ? t.charAt(0) + "█".repeat(Math.max(t.length - 1, 2)) : "█".repeat(t.length)))
    .join(" ");
  return `${tokens[0]} ${rest}`;
}

type BusinessWithCnae = Business & { cnae: CnaeCategory };

/** Dados liberados SEM unlock (nunca inclui contato/CNPJ/endereço completo). */
export function toPreview(b: BusinessWithCnae, unlockCount: number) {
  return {
    id: b.id,
    maskedName: maskName(b.displayName),
    category: b.cnae.label,
    group: b.cnae.group,
    groupLabel: groupLabel(b.cnae.group),
    bairro: b.bairro,
    presenceClass: b.presenceClass,
    presenceLabel: PRESENCE_LABEL[b.presenceClass] ?? b.presenceClass,
    score: b.score,
    hasPhone: Boolean(b.phone1 || b.phone2),
    hasEmail: Boolean(b.email),
    openedYear: b.openedAt ? b.openedAt.getUTCFullYear() : null,
    porte: b.porte,
    unlockCount,
    dataRef: b.ingestRef,
  };
}

/** Dados completos — só após unlock (ou admin). */
export function toFull(b: BusinessWithCnae, unlockCount: number) {
  return {
    ...toPreview(b, unlockCount),
    displayName: b.displayName,
    razaoSocial: b.razaoSocial,
    nomeFantasia: b.nomeFantasia,
    cnpj: b.cnpj,
    street: b.street,
    cep: b.cep,
    phone1: b.phone1,
    phone2: b.phone2,
    email: b.email,
    websiteUrl: b.websiteUrl,
    socialUrl: b.socialUrl,
    evidence: b.presenceEvidence,
  };
}

export type LeadPreview = ReturnType<typeof toPreview>;
export type LeadFull = ReturnType<typeof toFull>;
