"use server";

import { randomBytes } from "crypto";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { normalizeEmail } from "@/lib/auth";
import { sendPasswordReset } from "@/lib/mail";

/**
 * Pedido de redefinição de senha. Por segurança, sempre responde de forma
 * genérica (não revela se o e-mail existe).
 */
export async function requestReset(form: FormData) {
  const email = normalizeEmail(form.get("email"));
  if (email) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      const token = randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1h
      await prisma.passwordResetToken.create({ data: { token, userId: user.id, expiresAt } });

      const base = process.env.APP_URL ?? "http://localhost:3000";
      await sendPasswordReset(user.email, user.name, `${base}/redefinir?token=${token}`);
    }
  }
  redirect("/esqueci?sent=1");
}
