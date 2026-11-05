"use server";

import { revalidatePath } from "next/cache";
import { LeadStatus } from "@prisma/client";
import { requireUser } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { normalizeEmail } from "@/lib/emails";
import { parseFollowUpDate } from "@/lib/leads";

const VALID_STATUS = new Set(Object.values(LeadStatus));

/**
 * Define o status de prospecção de um estabelecimento (cria o registro do CRM
 * se for o primeiro contato). Status NOVO remove o registro — volta pra fila.
 */
export async function setStatusAction(form: FormData) {
  const session = await requireUser();
  const businessId = String(form.get("businessId") ?? "");
  const status = String(form.get("status") ?? "");
  const notes = form.get("notes");
  // campo ausente (botão rápido da fila) = não mexe; vazio = limpa o retorno
  const followUp = form.get("nextFollowUpAt");
  const followUpData =
    followUp !== null ? { nextFollowUpAt: parseFollowUpDate(String(followUp)) } : {};
  if (!businessId || !VALID_STATUS.has(status as LeadStatus)) return;

  if (status === "NOVO") {
    await prisma.prospection.deleteMany({ where: { businessId } });
  } else {
    await prisma.prospection.upsert({
      where: { businessId },
      update: {
        status: status as LeadStatus,
        updatedById: session.user.userId,
        ...(notes !== null ? { notes: String(notes) } : {}),
        ...followUpData,
      },
      create: {
        businessId,
        status: status as LeadStatus,
        notes: notes !== null ? String(notes) : "",
        ...followUpData,
        updatedById: session.user.userId,
      },
    });
  }

  revalidatePath("/app/leads");
  revalidatePath("/app/pipeline");
  revalidatePath(`/app/leads/${businessId}`);
}

/**
 * Lead pediu para não ser contatado (LGPD): carimba o opt-out, bloqueia o
 * e-mail para TODOS os CNPJs que o usam e registra no CRM como descartado.
 */
export async function optOutAction(form: FormData) {
  const session = await requireUser();
  const businessId = String(form.get("businessId") ?? "");
  const b = await prisma.business.findUnique({ where: { id: businessId }, include: { prospection: true } });
  if (!b) return;

  const now = new Date();
  const note = `Pediu para não ser contatado (LGPD) em ${now.toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
  })}.`;
  const email = normalizeEmail(b.email);
  await prisma.$transaction([
    prisma.business.update({ where: { id: b.id }, data: { optOutAt: now } }),
    ...(email
      ? [
          prisma.suppressedEmail.upsert({
            where: { email },
            update: {},
            create: { email, reason: `Opt-out do lead ${b.displayName || b.cnpj}` },
          }),
        ]
      : []),
    prisma.prospection.upsert({
      where: { businessId: b.id },
      update: {
        status: "DESCARTADO",
        nextFollowUpAt: null,
        notes: [b.prospection?.notes, note].filter(Boolean).join("\n"),
        updatedById: session.user.userId,
      },
      create: { businessId: b.id, status: "DESCARTADO", notes: note, updatedById: session.user.userId },
    }),
  ]);
  revalidateLead(b.id);
}

/** Desfaz um opt-out marcado por engano (e tira o e-mail da supressão). */
export async function undoOptOutAction(form: FormData) {
  await requireUser();
  const businessId = String(form.get("businessId") ?? "");
  const b = await prisma.business.findUnique({ where: { id: businessId } });
  if (!b?.optOutAt) return;
  const email = normalizeEmail(b.email);
  await prisma.$transaction([
    prisma.business.update({ where: { id: b.id }, data: { optOutAt: null } }),
    ...(email ? [prisma.suppressedEmail.deleteMany({ where: { email } })] : []),
  ]);
  revalidateLead(b.id);
}

function revalidateLead(businessId: string) {
  revalidatePath("/app/leads");
  revalidatePath("/app/pipeline");
  revalidatePath(`/app/leads/${businessId}`);
}
