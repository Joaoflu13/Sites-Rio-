import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import Topbar from "@/components/Topbar";

// Painel do admin. Stats completas entram no M7; por ora, atalhos.
export default async function AdminPage() {
  await requireAdmin();

  return (
    <>
      <Topbar />
      <main className="page">
        <h1>Painel do admin</h1>
        <div className="leads-grid">
          <Link className="card" href="/admin/exportar">
            <strong>Exportar listas (CSV)</strong>
            <p className="muted">Filtre estabelecimentos e baixe a lista completa para venda manual.</p>
          </Link>
          <Link className="card" href="/admin/usuarios">
            <strong>Usuários e créditos</strong>
            <p className="muted">Adicionar créditos após Pix, suspender contas, reset de senha.</p>
          </Link>
        </div>
      </main>
    </>
  );
}
