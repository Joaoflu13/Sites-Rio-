import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

/** Garante usuário logado (dev ou admin). Redireciona para /login caso contrário. */
export async function requireUser() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return session;
}

/** Garante que o usuário logado é ADMIN. Redireciona caso contrário. */
export async function requireAdmin() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/app/leads");
  return session;
}
