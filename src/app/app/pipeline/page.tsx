import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatPhone, STATUS_LABEL, whatsappUrl } from "@/lib/leads";

const COLUMNS = ["CONTATADO", "NEGOCIANDO", "FECHADO", "DESCARTADO"] as const;

// Pipeline do CRM: tudo que já foi trabalhado, agrupado por status.
export default async function PipelinePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const active = COLUMNS.includes(status as (typeof COLUMNS)[number])
    ? (status as (typeof COLUMNS)[number])
    : "CONTATADO";

  const counts = await prisma.prospection.groupBy({ by: ["status"], _count: true });
  const countOf = (s: string) => counts.find((c) => c.status === s)?._count ?? 0;

  const rows = await prisma.prospection.findMany({
    where: { status: active },
    include: { business: { include: { cnae: true } }, updatedBy: true },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });

  return (
    <main className="page">
      <h1>Pipeline</h1>
      <div className="stat-tiles">
        {COLUMNS.map((s) => (
          <Link key={s} href={`/app/pipeline?status=${s}`} className="card tile">
            <div className="num">{countOf(s)}</div>
            <div className="label">
              {STATUS_LABEL[s]}
              {s === active && " ◀"}
            </div>
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="card">
          <p style={{ margin: 0 }}>
            Nenhum lead em “{STATUS_LABEL[active]}”. Vá à{" "}
            <Link href="/app/leads">fila de prospecção</Link> e marque os primeiros contatos.
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
                <th>Notas</th>
                <th>Atualizado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const b = p.business;
                const wa = whatsappUrl(b.phone1 || b.phone2);
                return (
                  <tr key={p.id}>
                    <td>
                      <Link href={`/app/leads/${b.id}`}>{b.displayName || b.razaoSocial}</Link>
                    </td>
                    <td>{b.bairro}</td>
                    <td>{b.cnae.label}</td>
                    <td>{b.phone1 ? formatPhone(b.phone1) : "—"}</td>
                    <td style={{ maxWidth: 280, whiteSpace: "pre-wrap" }}>{p.notes || "—"}</td>
                    <td className="muted">
                      {p.updatedAt.toLocaleDateString("pt-BR")}
                      {p.updatedBy ? ` · ${p.updatedBy.name}` : ""}
                    </td>
                    <td>
                      {wa && (
                        <a className="btn btn--sm" href={wa} target="_blank" rel="noopener noreferrer">
                          WhatsApp
                        </a>
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
