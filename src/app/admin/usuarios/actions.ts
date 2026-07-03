"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { requireAdmin } from "@/lib/admin";
import { normalizeEmail } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sendWelcome } from "@/lib/mail";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Admin cria a conta de um membro da equipe (com senha inicial). */
export async function createUser(form: FormData) {
  await requireAdmin();
  const name = String(form.get("name") ?? "").trim();
  const email = normalizeEmail(form.get("email"));
  const password = String(form.get("password") ?? "");
  const role = String(form.get("role")) === "ADMIN" ? "ADMIN" : "MEMBER";

  if (name.length < 2) redirect("/admin/usuarios?error=nome");
  if (!EMAIL_RE.test(email)) redirect("/admin/usuarios?error=email");
  if (password.length < 8) redirect("/admin/usuarios?error=senha");

  const passwordHash = await bcrypt.hash(password, 10);
  try {
    await prisma.user.create({ data: { name, email, passwordHash, role } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      redirect("/admin/usuarios?error=existe");
    }
    throw e;
  }
  await sendWelcome(email, name);
  revalidatePath("/admin/usuarios");
  redirect("/admin/usuarios?ok=criado");
}

/** Suspende/reativa uma conta. Admin não consegue suspender a si mesmo. */
export async function setUserStatus(form: FormData) {
  const session = await requireAdmin();
  const userId = String(form.get("userId") ?? "");
  const status = String(form.get("status")) === "SUSPENDED" ? "SUSPENDED" : "ACTIVE";
  if (!userId || userId === session.user.userId) redirect("/admin/usuarios?error=proprio");

  await prisma.user.update({ where: { id: userId }, data: { status } });
  revalidatePath("/admin/usuarios");
  redirect("/admin/usuarios?ok=status");
}

/** Define uma nova senha para o usuário (reset manual pelo admin). */
export async function resetUserPassword(form: FormData) {
  await requireAdmin();
  const userId = String(form.get("userId") ?? "");
  const password = String(form.get("password") ?? "");
  if (!userId) redirect("/admin/usuarios");
  if (password.length < 8) redirect("/admin/usuarios?error=senha");

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { passwordHash } }),
    prisma.passwordResetToken.deleteMany({ where: { userId } }),
  ]);
  revalidatePath("/admin/usuarios");
  redirect("/admin/usuarios?ok=senha");
}
