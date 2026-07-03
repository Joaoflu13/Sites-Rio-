"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

export async function resetPassword(form: FormData) {
  const token = String(form.get("token") ?? "");
  const password = String(form.get("password") ?? "");
  if (!token) redirect("/esqueci");
  if (password.length < 8) redirect(`/redefinir?token=${encodeURIComponent(token)}&error=senha`);

  const row = await prisma.passwordResetToken.findUnique({
    where: { token },
    include: { user: true },
  });
  if (!row || row.expiresAt < new Date()) {
    redirect("/redefinir?error=token");
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.$transaction([
    prisma.user.update({ where: { id: row.userId }, data: { passwordHash } }),
    // Invalida todos os tokens pendentes do usuário.
    prisma.passwordResetToken.deleteMany({ where: { userId: row.userId } }),
  ]);

  redirect("/login?reset=1");
}
