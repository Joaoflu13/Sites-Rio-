import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { CNAE_GROUPS } from "@/lib/cnae";
import { PRESENCE_LABEL } from "@/lib/leads";
import { ACCOUNTANT_MIN_BUSINESSES, emailDiagnostics, isFreeMail } from "@/lib/emails";
import Topbar from "@/components/Topbar";

export const dynamic = "force-dynamic";

const pct = (n: number, d: number) => (d ? `${((n / d) * 100).toFixed(1).replace(".", ",")}%` : "—");
const fmt = (n: number) => n.toLocaleString("pt-BR");

// Prospecção por e-mail: raio-X da base, lote para a ferramenta de envio e
// lista de contadores (parceiros). O envio em si acontece FORA do sistema.
export default async function EmailsPage() {
  await requireAdmin();
  const [d, bairros] = await Promise.all([
    emailDiagnostics(prisma),
    prisma.business.groupBy({
      by: ["bairro"],
      _count: true,
      orderBy: { _count: { bairro: "desc" } },
      take: 200,
    }),
  ]);

  return (
    <>
      <Topbar />
      <main className="page">
        <p>
          <Link href="/admin">← Admin</Link>
        </p>
        <h1>Prospecção por e-mail</h1>

        <h2>Raio-X dos e-mails da base</h2>
        <div className="stat-tiles">
          <div className="card tile">
            <div className="num">{fmt(d.withEmail)}</div>
            <div className="label">Com e-mail ({pct(d.withEmail, d.total)} da base)</div>
          </div>
          <div className="card tile">
            <div className="num">{fmt(d.businessesWithAccountantEmail)}</div>
            <div className="label">Com e-mail de provável contador</div>
          </div>
          <div className="card tile">
            <div className="num">{fmt(d.reachable)}</div>
            <div className="label">Alcançáveis (e-mail próprio, fora do CRM)</div>
          </div>
          <div className="card tile">
            <div className="num">{fmt(d.reachableSellable)}</div>
            <div className="label">Alcançáveis e sem site próprio</div>
          </div>
        </div>
        <div className="card" style={{ marginBottom: 20 }}>
          <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
            <li>
              Base total: <strong>{fmt(d.total)}</strong> estabelecimentos · e-mails distintos:{" "}
              <strong>{fmt(d.distinctEmails)}</strong>
            </li>
            <li>
              Prováveis contadores (mesmo e-mail em {ACCOUNTANT_MIN_BUSINESSES}+ CNPJs):{" "}
              <strong>{fmt(d.accountantEmails)}</strong> e-mails cobrindo{" "}
              <strong>{fmt(d.businessesWithAccountantEmail)}</strong> estabelecimentos (
              {pct(d.businessesWithAccountantEmail, d.withEmail)} dos que têm e-mail) — ficam fora da fila.
            </li>
            <li>
              Dos alcançáveis, <strong>{pct(d.reachableFreeMail, d.reachable)}</strong> são Gmail/Hotmail/etc.
              (no MEI, costuma ser o e-mail pessoal do dono).
            </li>
            <li>
              Lista de supressão: <strong>{fmt(d.suppressed)}</strong> e-mails · leads com opt-out:{" "}
              <strong>{fmt(d.optedOut)}</strong> · <Link href="/admin/supressao">gerenciar</Link>
            </li>
          </ul>
        </div>

        <h2>Gerar lote de e-mails (CSV)</h2>
        <p className="muted">
          Um lead por e-mail, maior score primeiro. Fora do lote: quem já está no CRM, quem pediu para sair, e-mails
          de contador e da supressão. Cada linha traz assunto e mensagem prontos, com o link da demo marcado como
          e-mail (a visita aparece no CRM como &quot;via e-mail&quot;). Importe na sua ferramenta de envio — não
          envie pelo Resend do sistema.
        </p>
        <form className="card filters" action="/api/admin/email-queue" method="POST" style={{ marginTop: 12 }}>
          <div>
            <label htmlFor="bairro">Bairro</label>
            <select id="bairro" name="bairro" defaultValue="">
              <option value="">Todos</option>
              {bairros.map((b) => (
                <option key={b.bairro} value={b.bairro}>
                  {b.bairro} ({b._count})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="group">Segmento</label>
            <select id="group" name="group" defaultValue="">
              <option value="">Todos</option>
              {CNAE_GROUPS.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="presence">Presença web</label>
            <select id="presence" name="presence" defaultValue="">
              <option value="">Sem site próprio (todas)</option>
              {Object.entries(PRESENCE_LABEL)
                .filter(([v]) => v !== "HAS_SITE")
                .map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label htmlFor="minScore">Score mín.</label>
            <input id="minScore" name="minScore" type="number" min={0} max={100} placeholder="0" />
          </div>
          <div>
            <label htmlFor="limit">Tamanho do lote</label>
            <input id="limit" name="limit" type="number" min={1} max={500} defaultValue={50} />
          </div>
          <div style={{ minWidth: 240 }}>
            <label htmlFor="signature">Assinatura</label>
            <input
              id="signature"
              name="signature"
              defaultValue={process.env.SALES_SIGNATURE ?? ""}
              placeholder="ex.: João — Sites Rio · (21) 9…"
            />
          </div>
          <div style={{ minWidth: "100%" }}>
            <label style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 400 }}>
              <input type="checkbox" name="ownDomainOnly" style={{ width: "auto" }} /> Só e-mails de domínio próprio
              (sem Gmail/Hotmail)
            </label>
            <label style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 400 }}>
              <input type="checkbox" name="mark" defaultChecked style={{ width: "auto" }} /> Marcar o lote como
              &quot;Contatado&quot; e agendar retorno em 3 dias (evita mandar duas vezes)
            </label>
          </div>
          <div className="actions">
            <button className="btn" type="submit" style={{ whiteSpace: "nowrap" }}>
              Baixar lote
            </button>
          </div>
        </form>

        <h2 style={{ marginTop: 28 }}>Escritórios de contabilidade (parceiros)</h2>
        <p className="muted">
          E-mails que aparecem em vários CNPJs — quase sempre o contador que abriu as empresas. São candidatos a
          parceria (indicação com comissão), não leads.{" "}
          <a href="/api/admin/contadores">Baixar lista completa (CSV)</a>
        </p>
        {d.topAccountants.length === 0 ? (
          <p className="muted">Nenhum e-mail repetido na base.</p>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>E-mail</th>
                  <th>Empresas</th>
                  <th>Tipo</th>
                </tr>
              </thead>
              <tbody>
                {d.topAccountants.map((a) => (
                  <tr key={a.email}>
                    <td>{a.email}</td>
                    <td>{fmt(a.count)}</td>
                    <td className="muted">{isFreeMail(a.email) ? "provedor gratuito" : "domínio próprio"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  );
}
