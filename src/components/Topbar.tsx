import Link from "next/link";
import { auth, signOut } from "@/lib/auth";
import { prisma } from "@/lib/db";

/** Barra de navegação da área logada (equipe de prospecção). */
export default async function Topbar() {
  const session = await auth();
  if (!session?.user) return null;

  // respostas humanas aos e-mails do assistente que ainda esperam alguém
  const pendingReplies = await prisma.emailMessage
    .count({ where: { direction: "IN", kind: "HUMAN", handledAt: null } })
    .catch(() => 0);

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
          <Link href="/app/leads">Prospecção</Link>
          <Link href="/app/pipeline">Pipeline</Link>
          <Link href="/app/respostas">
            Respostas{pendingReplies > 0 && <span className="nav-count">{pendingReplies}</span>}
          </Link>
          {session.user.role === "ADMIN" && <Link href="/admin">Admin</Link>}
        </nav>
        <div className="spacer" />
        <span className="muted" style={{ fontSize: "0.85rem" }}>
          {session.user.name}
        </span>
        <form action={logout}>
          <button className="btn btn--ghost btn--sm" type="submit">
            Sair
          </button>
        </form>
      </div>
    </header>
  );
}
