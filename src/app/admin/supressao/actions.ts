"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { normalizeEmail } from "@/lib/emails";

/** Adiciona e-mails à supressão (um por linha; ex.: quem respondeu SAIR ao e-mail). */
export async function addSuppressionAction(form: FormData) {
  await requireAdmin();
  const reason = String(form.get("reason") ?? "").trim().slice(0, 200) || "Pediu para sair";
  const emails = [
    ...new Set(
      String(form.get("emails") ?? "")
        .split(/[\s,;]+/)
        .map(normalizeEmail)
        .filter(Boolean)
    ),
  ];
  if (emails.length === 0) return;
  await prisma.suppressedEmail.createMany({
    data: emails.map((email) => ({ email, reason })),
    skipDuplicates: true,
  });
  revalidatePath("/admin/supressao");
  revalidatePath("/admin/emails");
}

/** Remove um e-mail da supressão (adicionado por engano). */
export async function removeSuppressionAction(form: FormData) {
  await requireAdmin();
  const email = normalizeEmail(String(form.get("email") ?? ""));
  if (!email) return;
  await prisma.suppressedEmail.deleteMany({ where: { email } });
  revalidatePath("/admin/supressao");
  revalidatePath("/admin/emails");
}
