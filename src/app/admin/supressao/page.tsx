import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";
import Topbar from "@/components/Topbar";
import { addSuppressionAction, removeSuppressionAction } from "./actions";

// Lista de supressão (LGPD): e-mails que nunca mais recebem prospecção, em
// nenhum CNPJ. Opt-out de um lead específico é feito no detalhe do lead.
export default async function SupressaoPage() {
  await requireAdmin();
  const [total, rows, optedOut] = await Promise.all([
    prisma.suppressedEmail.count(),
    prisma.suppressedEmail.findMany({ orderBy: { createdAt: "desc" }, take: 300 }),
    prisma.business.findMany({
      where: { optOutAt: { not: null } },
      orderBy: { optOutAt: "desc" },
      select: { id: true, displayName: true, razaoSocial: true, bairro: true, optOutAt: true },
      take: 100,
    }),
  ]);

  return (
    <>
      <Topbar />
      <main className="page">
        <p>
          <Link href="/admin/emails">← Prospecção por e-mail</Link>
        </p>
        <h1>Lista de supressão</h1>
        <p className="muted">
          E-mails aqui saem de todos os lotes e exports. Quem responder SAIR (ou pedir remoção por qualquer canal)
          entra aqui no mesmo dia.
        </p>

        <form className="card" action={addSuppressionAction} style={{ marginTop: 12 }}>
          <label htmlFor="emails">E-mails (um por linha, ou separados por vírgula)</label>
          <textarea id="emails" name="emails" rows={4} placeholder={"contato@exemplo.com.br\noutro@gmail.com"} />
          <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap", marginTop: 10 }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <label htmlFor="reason">Motivo</label>
              <input id="reason" name="reason" placeholder="Respondeu SAIR" />
            </div>
            <button className="btn" type="submit">
              Adicionar
            </button>
          </div>
        </form>

        <h2>E-mails suprimidos ({total.toLocaleString("pt-BR")})</h2>
        {rows.length === 0 ? (
          <p className="muted">Nenhum ainda.</p>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>E-mail</th>
                  <th>Motivo</th>
                  <th>Desde</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.email}>
                    <td>{r.email}</td>
                    <td className="muted">{r.reason || "—"}</td>
                    <td className="muted">
                      {r.createdAt.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                    </td>
                    <td>
                      <form action={removeSuppressionAction}>
                        <input type="hidden" name="email" value={r.email} />
                        <button className="btn btn--ghost btn--sm" type="submit">
                          Remover
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <h2 style={{ marginTop: 28 }}>Leads com opt-out ({optedOut.length})</h2>
        {optedOut.length === 0 ? (
          <p className="muted">Nenhum.</p>
        ) : (
          <ul style={{ paddingLeft: 18 }}>
            {optedOut.map((b) => (
              <li key={b.id}>
                <Link href={`/app/leads/${b.id}`}>{b.displayName || b.razaoSocial}</Link>{" "}
                <span className="muted">
                  · {b.bairro} · {b.optOutAt!.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
