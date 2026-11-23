"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { mailerFromEnv } from "@/lib/sdr/mailer";
import { sendBookingLink } from "@/lib/sdr/run";

/** Aprovação com 1 clique: responde na mesma conversa com o link da agenda. */
export async function sendBookingLinkAction(form: FormData) {
  const session = await requireUser();
  const id = String(form.get("messageId") ?? "");
  let err: string | null;
  try {
    err = await sendBookingLink(prisma, mailerFromEnv(), id, session.user.userId);
  } catch (e) {
    err = `Falha no envio: ${(e as Error).message}`;
  }
  revalidatePath("/app/respostas");
  redirect(`/app/respostas?msg=${encodeURIComponent(err ?? "Link da agenda enviado.")}`);
}

/** "Já respondi pelo Gmail": tira da lista de pendentes. */
export async function markHandledAction(form: FormData) {
  const session = await requireUser();
  const id = String(form.get("messageId") ?? "");
  await prisma.emailMessage.updateMany({
    where: { id, direction: "IN", handledAt: null },
    data: { handledAt: new Date(), handledById: session.user.userId },
  });
  revalidatePath("/app/respostas");
}
