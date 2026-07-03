import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { groupLabel } from "@/lib/cnae";
import { PRESENCE_LABEL, STATUS_LABEL } from "@/lib/leads";
import Topbar from "@/components/Topbar";

// Painel do admin: visão geral do banco de leads, do CRM e dos runs.
export default async function AdminPage() {
  await requireAdmin();

  const [total, byClass, byCnae, cats, byStatus, users, runs] = await Promise.all([
    prisma.business.count(),
    prisma.business.groupBy({ by: ["presenceClass"], _count: true }),
    prisma.business.groupBy({ by: ["cnaeCode"], _count: true }),
    prisma.cnaeCategory.findMany(),
    prisma.prospection.groupBy({ by: ["status"], _count: true }),
    prisma.user.count(),
    prisma.ingestionRun.findMany({ orderBy: { startedAt: "desc" }, take: 5 }),
  ]);

  const byGroup = new Map<string, number>();
  for (const r of byCnae) {
    const g = cats.find((c) => c.code === r.cnaeCode)?.group ?? "?";
    byGroup.set(g, (byGroup.get(g) ?? 0) + r._count);
  }
  const countClass = (c: string) => byClass.find((r) => r.presenceClass === c)?._count ?? 0;

  return (
    <>
      <Topbar />
      <main className="page">
        <h1>Painel do admin</h1>

        <div className="stat-tiles">
          <div className="card tile">
            <div className="num">{total.toLocaleString("pt-BR")}</div>
            <div className="label">Estabelecimentos</div>
          </div>
          <div className="card tile">
            <div className="num">{countClass("NO_SITE").toLocaleString("pt-BR")}</div>
            <div className="label">Sem site</div>
          </div>
          <div className="card tile">
            <div className="num">{countClass("SOCIAL_ONLY").toLocaleString("pt-BR")}</div>
            <div className="label">Só rede social</div>
          </div>
          <div className="card tile">
            <div className="num">{countClass("UNKNOWN").toLocaleString("pt-BR")}</div>
            <div className="label">Não verificados</div>
          </div>
          <div className="card tile">
            <div className="num">{users}</div>
            <div className="label">Usuários</div>
          </div>
        </div>

        <div className="leads-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
          <section className="card">
            <h2 style={{ marginTop: 0 }}>Por presença web</h2>
            <ul style={{ paddingLeft: 18, margin: 0 }}>
              {Object.entries(PRESENCE_LABEL).map(([v, l]) => (
                <li key={v}>
                  {l}: <strong>{countClass(v).toLocaleString("pt-BR")}</strong>
                </li>
              ))}
            </ul>
          </section>

          <section className="card">
            <h2 style={{ marginTop: 0 }}>Por segmento</h2>
            <ul style={{ paddingLeft: 18, margin: 0 }}>
              {[...byGroup.entries()]
                .sort((a, b) => b[1] - a[1])
                .map(([g, n]) => (
                  <li key={g}>
                    {groupLabel(g)}: <strong>{n.toLocaleString("pt-BR")}</strong>
                  </li>
                ))}
            </ul>
          </section>

          <section className="card">
            <h2 style={{ marginTop: 0 }}>CRM</h2>
            <ul style={{ paddingLeft: 18, margin: 0 }}>
              {byStatus.length === 0 && <li className="muted">Nada trabalhado ainda.</li>}
              {byStatus.map((r) => (
                <li key={r.status}>
                  {STATUS_LABEL[r.status]}: <strong>{r._count}</strong>
                </li>
              ))}
            </ul>
          </section>

          <section className="card">
            <h2 style={{ marginTop: 0 }}>Runs recentes</h2>
            <ul style={{ paddingLeft: 18, margin: 0, fontSize: "0.85rem" }}>
              {runs.length === 0 && <li className="muted">Nenhum run ainda.</li>}
              {runs.map((r) => (
                <li key={r.id}>
                  {r.startedAt.toLocaleDateString("pt-BR")} {r.kind} {r.sourceRef} — {r.status}{" "}
                  ({r.affectedRows.toLocaleString("pt-BR")} linhas)
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div style={{ marginTop: 20, display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Link className="btn" href="/admin/exportar">
            Exportar CSV
          </Link>
          <Link className="btn btn--ghost" href="/admin/usuarios">
            Usuários
          </Link>
        </div>
      </main>
    </>
  );
}
