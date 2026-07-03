import Link from "next/link";
import { auth, signOut } from "@/lib/auth";
import { prisma } from "@/lib/db";

/** Barra de navegação da área logada (dev e admin). Mostra o saldo de créditos. */
export default async function Topbar() {
  const session = await auth();
  if (!session?.user) return null;

  const me = await prisma.user.findUnique({
    where: { id: session.user.userId },
    select: { creditBalance: true, role: true, name: true },
  });

  async function logout() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <header className="topbar">
      <div className="inner">
        <Link className="logo" href="/app/leads">
          Sites <span>Rio</span>
        </Link>
        <nav>
          <Link href="/app/leads">Leads</Link>
          <Link href="/app/meus-leads">Meus leads</Link>
          <Link href="/app/creditos">Créditos</Link>
          {me?.role === "ADMIN" && <Link href="/admin">Admin</Link>}
        </nav>
        <div className="spacer" />
        <span className="saldo">{me?.creditBalance ?? 0} créditos</span>
        <form action={logout}>
          <button className="btn btn--ghost btn--sm" type="submit">
            Sair
          </button>
        </form>
      </div>
    </header>
  );
}
