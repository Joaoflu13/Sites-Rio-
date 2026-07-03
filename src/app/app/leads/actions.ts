"use server";

import { revalidatePath } from "next/cache";
import { LeadStatus } from "@prisma/client";
import { requireUser } from "@/lib/admin";
import { prisma } from "@/lib/db";

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
      },
      create: {
        businessId,
        status: status as LeadStatus,
        notes: notes !== null ? String(notes) : "",
        updatedById: session.user.userId,
      },
    });
  }

  revalidatePath("/app/leads");
  revalidatePath("/app/pipeline");
  revalidatePath(`/app/leads/${businessId}`);
}
