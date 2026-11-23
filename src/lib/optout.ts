// Opt-out (LGPD) de um lead: usado pelo botão no CRM e pelo assistente quando
// alguém responde SAIR. Carimba o lead, bloqueia o e-mail em TODOS os CNPJs,
// para a sequência do assistente e registra no CRM como descartado.

import type { PrismaClient } from "@prisma/client";
import { normalizeEmail } from "@/lib/emails";

export async function applyOptOut(
  prisma: PrismaClient,
  businessId: string,
  opts: { userId?: string | null; note: string; extraEmail?: string }
): Promise<void> {
  const b = await prisma.business.findUnique({ where: { id: businessId }, include: { prospection: true } });
  if (!b) return;
  const now = new Date();
  const emails = [...new Set([normalizeEmail(b.email), normalizeEmail(opts.extraEmail)].filter(Boolean))];
  await prisma.$transaction([
    prisma.business.update({ where: { id: b.id }, data: { optOutAt: b.optOutAt ?? now } }),
    ...emails.map((email) =>
      prisma.suppressedEmail.upsert({
        where: { email },
        update: {},
        create: { email, reason: `Opt-out do lead ${b.displayName || b.cnpj}` },
      })
    ),
    prisma.emailSequence.updateMany({
      where: { businessId: b.id, status: "ACTIVE" },
      data: { status: "OPTED_OUT", endedAt: now },
    }),
    prisma.prospection.upsert({
      where: { businessId: b.id },
      update: {
        status: "DESCARTADO",
        nextFollowUpAt: null,
        notes: [b.prospection?.notes, opts.note].filter(Boolean).join("\n"),
        ...(opts.userId ? { updatedById: opts.userId } : {}),
      },
      create: { businessId: b.id, status: "DESCARTADO", notes: opts.note, updatedById: opts.userId ?? null },
    }),
  ]);
}

/** Nota padrão com a data de hoje em Brasília. */
export function optOutNote(prefix = "Pediu para não ser contatado (LGPD)"): string {
  return `${prefix} em ${new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}.`;
}
