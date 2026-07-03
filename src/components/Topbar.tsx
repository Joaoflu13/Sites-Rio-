import Link from "next/link";
import { auth, signOut } from "@/lib/auth";

/** Barra de navegação da área logada (equipe de prospecção). */
export default async function Topbar() {
  const session = await auth();
  if (!session?.user) return null;

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
