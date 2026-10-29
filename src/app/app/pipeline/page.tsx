import Link from "next/link";
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { endOfTodayBRT, formatPhone, STATUS_LABEL, whatsappUrl } from "@/lib/leads";

const COLUMNS = ["RETORNOS", "CONTATADO", "NEGOCIANDO", "FECHADO", "DESCARTADO"] as const;
const LABEL: Record<string, string> = { ...STATUS_LABEL, RETORNOS: "Retornos p/ hoje" };

// Pipeline do CRM: tudo que já foi trabalhado, agrupado por status. A aba
// "Retornos" junta os leads em aberto com retorno vencido ou marcado para hoje.
export default async function PipelinePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const active = COLUMNS.includes(status as (typeof COLUMNS)[number])
    ? (status as (typeof COLUMNS)[number])
    : "CONTATADO";

  const endOfToday = endOfTodayBRT();
  const dueWhere: Prisma.ProspectionWhereInput = {
    status: { in: ["CONTATADO", "NEGOCIANDO"] },
    nextFollowUpAt: { lte: endOfToday },
  };

  const [counts, dueCount] = await Promise.all([
    prisma.prospection.groupBy({ by: ["status"], _count: true }),
    prisma.prospection.count({ where: dueWhere }),
  ]);
  const countOf = (s: string) =>
    s === "RETORNOS" ? dueCount : (counts.find((c) => c.status === s)?._count ?? 0);

  const rows = await prisma.prospection.findMany({
    where: active === "RETORNOS" ? dueWhere : { status: active },
    include: { business: { include: { cnae: true } }, updatedBy: true },
    orderBy: active === "RETORNOS" ? { nextFollowUpAt: "asc" } : { updatedAt: "desc" },
    take: 200,
  });
  const startOfToday = new Date(endOfToday.getTime() - 24 * 60 * 60 * 1000 + 1);

  return (
    <main className="page">
      <h1>Pipeline</h1>
      <div className="stat-tiles">
        {COLUMNS.map((s) => (
          <Link key={s} href={`/app/pipeline?status=${s}`} className="card tile">
            <div className="num">{countOf(s)}</div>
            <div className="label">
              {LABEL[s]}
              {s === active && " ◀"}
            </div>
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="card">
          <p style={{ margin: 0 }}>
            {active === "RETORNOS" ? (
              <>Nenhum retorno pendente para hoje. Defina o “Próximo retorno” no detalhe do lead.</>
            ) : (
              <>
                Nenhum lead em “{LABEL[active]}”. Vá à{" "}
                <Link href="/app/leads">fila de prospecção</Link> e marque os primeiros contatos.
              </>
            )}
          </p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Estabelecimento</th>
                <th>Bairro</th>
                <th>Categoria</th>
                <th>Telefone</th>
                {active === "RETORNOS" && <th>Status</th>}
                <th>Retorno</th>
                <th>Notas</th>
                <th>Atualizado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const b = p.business;
                const wa = whatsappUrl(b.phone1, b.phone2);
                const callPhone = b.phone1 || b.phone2;
                return (
                  <tr key={p.id}>
                    <td>
                      <Link href={`/app/leads/${b.id}`}>{b.displayName || b.razaoSocial}</Link>
                    </td>
                    <td>{b.bairro}</td>
                    <td>{b.cnae.label}</td>
                    <td>
                      {callPhone ? formatPhone(callPhone) : "—"}
                      {callPhone && !wa && <span className="muted"> · fixo</span>}
                    </td>
                    {active === "RETORNOS" && <td>{STATUS_LABEL[p.status]}</td>}
                    <td className={p.nextFollowUpAt && p.nextFollowUpAt < startOfToday ? "error" : ""}>
                      {p.nextFollowUpAt
                        ? p.nextFollowUpAt.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })
                        : "—"}
                    </td>
                    <td style={{ maxWidth: 280, whiteSpace: "pre-wrap" }}>{p.notes || "—"}</td>
                    <td className="muted">
                      {p.updatedAt.toLocaleDateString("pt-BR")}
                      {p.updatedBy ? ` · ${p.updatedBy.name}` : ""}
                    </td>
                    <td>
                      {wa ? (
                        <a className="btn btn--sm" href={wa} target="_blank" rel="noopener noreferrer">
                          WhatsApp
                        </a>
                      ) : (
                        callPhone && (
                          <a className="btn btn--ghost btn--sm" href={`tel:+55${callPhone}`}>
                            Ligar
                          </a>
                        )
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
