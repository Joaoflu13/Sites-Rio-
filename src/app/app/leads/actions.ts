"use server";

import { revalidatePath } from "next/cache";
import { LeadStatus } from "@prisma/client";
import { requireUser } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { normalizeEmail } from "@/lib/emails";
import { applyOptOut, optOutNote } from "@/lib/optout";
import { enrollLeads } from "@/lib/sdr/run";
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
 * e-mail para TODOS os CNPJs que o usam, para a sequência do assistente e
 * registra no CRM como descartado (src/lib/optout.ts).
 */
export async function optOutAction(form: FormData) {
  const session = await requireUser();
  const businessId = String(form.get("businessId") ?? "");
  if (!businessId) return;
  await applyOptOut(prisma, businessId, { userId: session.user.userId, note: optOutNote() });
  revalidateLead(businessId);
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

/** Coloca UM lead na sequência do assistente (se o e-mail puder receber). */
export async function enrollLeadAction(form: FormData) {
  const session = await requireUser();
  const businessId = String(form.get("businessId") ?? "");
  const b = await prisma.business.findUnique({ where: { id: businessId } });
  const email = normalizeEmail(b?.email);
  if (!b || !email || b.optOutAt) return;
  if (await prisma.suppressedEmail.findUnique({ where: { email } })) return;
  // negociação em andamento é com gente, não com o assistente
  const p = await prisma.prospection.findUnique({ where: { businessId } });
  if (p && p.status !== "CONTATADO") return;
  await enrollLeads(prisma, [{ businessId: b.id, email }], session.user.userId);
  revalidateLead(b.id);
}

/** Para a sequência do assistente para este lead (nada mais é enviado). */
export async function stopSequenceAction(form: FormData) {
  await requireUser();
  const businessId = String(form.get("businessId") ?? "");
  await prisma.emailSequence.updateMany({
    where: { businessId, status: "ACTIVE" },
    data: { status: "STOPPED", endedAt: new Date() },
  });
  revalidateLead(businessId);
}
