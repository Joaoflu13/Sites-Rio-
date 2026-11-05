// Qualidade dos e-mails da base da RFB para prospecção.
//
// O campo e-mail do CNPJ costuma ser do CONTADOR (o escritório abre a empresa e
// põe o próprio e-mail): o mesmo endereço aparece em vários CNPJs. Esses saem
// da fila de e-mail — e viram a lista de escritórios para parceria.

import type { PrismaClient } from "@prisma/client";
import { groupLabel } from "@/lib/cnae";

/** Mesmo e-mail em N+ estabelecimentos = provável contador. */
export const ACCOUNTANT_MIN_BUSINESSES = 3;

const FREE_MAIL = new Set([
  "gmail.com", "hotmail.com", "hotmail.com.br", "outlook.com", "outlook.com.br", "live.com",
  "yahoo.com", "yahoo.com.br", "ymail.com", "bol.com.br", "uol.com.br", "terra.com.br",
  "ig.com.br", "icloud.com", "me.com", "globo.com", "globomail.com", "msn.com", "r7.com",
  "zipmail.com.br", "oi.com.br",
]);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** lowercase + trim; "" se não parece e-mail. */
export function normalizeEmail(raw: string | null | undefined): string {
  const e = (raw ?? "").trim().toLowerCase();
  return EMAIL_RE.test(e) ? e : "";
}

export function emailDomain(email: string): string {
  return email.split("@")[1] ?? "";
}

/** Provedor gratuito (Gmail, Hotmail…): no MEI costuma ser o e-mail pessoal do dono. */
export function isFreeMail(email: string): boolean {
  return FREE_MAIL.has(emailDomain(email));
}

/** E-mails usados por N+ estabelecimentos, com a contagem (maior primeiro). */
export async function sharedEmails(
  prisma: PrismaClient,
  min = ACCOUNTANT_MIN_BUSINESSES
): Promise<{ email: string; count: number }[]> {
  const rows = await prisma.business.groupBy({
    by: ["email"],
    where: { email: { not: "" } },
    _count: { _all: true },
    having: { email: { _count: { gte: min } } },
  });
  return rows
    .map((r) => ({ email: r.email, count: r._count._all }))
    .sort((a, b) => b.count - a.count);
}

export type EmailDiagnostics = {
  total: number;
  withEmail: number;
  distinctEmails: number;
  accountantEmails: number;
  businessesWithAccountantEmail: number;
  suppressed: number;
  optedOut: number;
  /** e-mail próprio, sem opt-out, ainda sem registro no CRM */
  reachable: number;
  /** reachable com presença web vendável (sem site, site grátis, só rede/agregador) */
  reachableSellable: number;
  reachableFreeMail: number;
  topAccountants: { email: string; count: number }[];
};

export const SELLABLE_PRESENCE = ["NO_SITE", "WEAK_SITE", "SOCIAL_ONLY", "AGGREGATOR_ONLY"] as const;

/**
 * E-mails que não recebem prospecção: prováveis contadores + lista de supressão.
 * Filtrado em memória (podem ser milhares — grande demais para um NOT IN).
 */
export async function blockedEmailSet(prisma: PrismaClient): Promise<Set<string>> {
  const [shared, suppressed] = await Promise.all([
    sharedEmails(prisma),
    prisma.suppressedEmail.findMany({ select: { email: true } }),
  ]);
  return new Set([...shared.map((s) => s.email), ...suppressed.map((s) => s.email)]);
}

/** Raio-X dos e-mails da base (usado em /admin/emails e em `npm run emails`). */
export async function emailDiagnostics(prisma: PrismaClient): Promise<EmailDiagnostics> {
  const [total, withEmail, distinct, shared, suppressed, optedOut, candidates] = await Promise.all([
    prisma.business.count(),
    prisma.business.count({ where: { email: { not: "" } } }),
    prisma.business.groupBy({ by: ["email"], where: { email: { not: "" } } }),
    sharedEmails(prisma),
    prisma.suppressedEmail.count(),
    prisma.business.count({ where: { optOutAt: { not: null } } }),
    // ainda não trabalhados, sem opt-out, com e-mail
    prisma.business.findMany({
      where: { email: { not: "" }, optOutAt: null, prospection: null },
      select: { email: true, presenceClass: true },
    }),
  ]);
  const blocked = await blockedEmailSet(prisma);
  const reachable = candidates
    .map((r) => ({ ...r, email: normalizeEmail(r.email) }))
    .filter((r) => r.email && !blocked.has(r.email));
  const sellable = new Set<string>(SELLABLE_PRESENCE);
  return {
    total,
    withEmail,
    distinctEmails: distinct.length,
    accountantEmails: shared.length,
    businessesWithAccountantEmail: shared.reduce((n, s) => n + s.count, 0),
    suppressed,
    optedOut,
    reachable: reachable.length,
    reachableSellable: reachable.filter((r) => sellable.has(r.presenceClass)).length,
    reachableFreeMail: reachable.filter((r) => isFreeMail(r.email)).length,
    topAccountants: shared.slice(0, 30),
  };
}

export const ACCOUNTANT_CSV_HEADER = [
  "email", "qtd_empresas", "bairros_principais", "segmentos", "exemplos_de_clientes", "provedor_gratuito",
];

/**
 * Prováveis escritórios de contabilidade (e-mail em N+ CNPJs) com o perfil da
 * carteira — lista de prospecção de PARCEIROS (Fase 3 do plano).
 */
export async function accountantRows(prisma: PrismaClient): Promise<unknown[][]> {
  const shared = await sharedEmails(prisma);
  const byEmail = new Map<string, { bairro: string; group: string; name: string }[]>();
  for (let i = 0; i < shared.length; i += 1000) {
    const chunk = shared.slice(i, i + 1000).map((s) => s.email);
    const rows = await prisma.business.findMany({
      where: { email: { in: chunk } },
      select: { email: true, bairro: true, displayName: true, cnae: { select: { group: true } } },
    });
    for (const r of rows) {
      const list = byEmail.get(r.email) ?? [];
      list.push({ bairro: r.bairro, group: r.cnae.group, name: r.displayName });
      byEmail.set(r.email, list);
    }
  }
  const top = (values: string[], n: number) =>
    [...values.reduce((m, v) => m.set(v, (m.get(v) ?? 0) + 1), new Map<string, number>())]
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([v]) => v)
      .join(", ");
  return shared.map((s) => {
    const list = byEmail.get(s.email) ?? [];
    return [
      s.email,
      s.count,
      top(list.map((l) => l.bairro), 3),
      top(list.map((l) => groupLabel(l.group)), 3),
      list.slice(0, 3).map((l) => l.name).filter(Boolean).join(" | "),
      isFreeMail(s.email) ? "sim" : "não",
    ];
  });
}
