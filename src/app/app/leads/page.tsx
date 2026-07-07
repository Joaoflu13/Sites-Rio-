import Link from "next/link";
import { prisma } from "@/lib/db";
import { CNAE_GROUPS, groupLabel } from "@/lib/cnae";
import {
  buildLeadWhere,
  formatPhone,
  PRESENCE_LABEL,
  STATUS_LABEL,
  whatsappUrl,
} from "@/lib/leads";
import { demoSlug } from "@/lib/slug";
import { setStatusAction } from "./actions";

const PAGE_SIZE = 30;

const BADGE_CLASS: Record<string, string> = {
  NO_SITE: "badge--nosite",
  SOCIAL_ONLY: "badge--social",
  AGGREGATOR_ONLY: "badge--aggregator",
  HAS_SITE: "badge--hassite",
  UNKNOWN: "badge--unknown",
};

// Fila de prospecção: estabelecimentos ainda não trabalhados (sem Prospection),
// ordenados por score. Dados completos — ferramenta interna da equipe.
export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{
    bairro?: string;
    group?: string;
    presence?: string;
    minScore?: string;
    q?: string;
    pagina?: string;
  }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.pagina) || 1);
  const where = {
    ...buildLeadWhere({
      bairro: sp.bairro,
      group: sp.group,
      presence: sp.presence,
      minScore: Number(sp.minScore) || undefined,
      q: sp.q,
    }),
    prospection: null, // fila = ainda sem registro no CRM
  };

  const [total, leads, bairros] = await Promise.all([
    prisma.business.count({ where }),
    prisma.business.findMany({
      where,
      include: { cnae: true },
      orderBy: [{ score: "desc" }, { id: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.business.groupBy({
      by: ["bairro"],
      _count: true,
      orderBy: { _count: { bairro: "desc" } },
      take: 120,
    }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <main className="page">
      <h1>Fila de prospecção</h1>
      <p className="muted">
        {total.toLocaleString("pt-BR")} estabelecimento(s) ainda não trabalhados. Marque
        &quot;Contatado&quot; para mover ao pipeline.
      </p>

      <form className="card filters" method="GET" style={{ marginTop: 12 }}>
        <div>
          <label htmlFor="q">Nome</label>
          <input id="q" name="q" defaultValue={sp.q ?? ""} placeholder="ex.: padaria" />
        </div>
        <div>
          <label htmlFor="bairro">Bairro</label>
          <select id="bairro" name="bairro" defaultValue={sp.bairro ?? ""}>
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
          <select id="group" name="group" defaultValue={sp.group ?? ""}>
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
          <select id="presence" name="presence" defaultValue={sp.presence ?? ""}>
            <option value="">Todas</option>
            {Object.entries(PRESENCE_LABEL).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="minScore">Score mín.</label>
          <input
            id="minScore"
            name="minScore"
            type="number"
            min={0}
            max={100}
            defaultValue={sp.minScore ?? ""}
          />
        </div>
        <div className="actions">
          <button className="btn" type="submit">
            Filtrar
          </button>
        </div>
      </form>

      {leads.length === 0 ? (
        <div className="card" style={{ marginTop: 16 }}>
          <p style={{ margin: 0 }}>
            Nada na fila com esses filtros.{" "}
            {total === 0 && "Se o banco está vazio, rode a ingestão (npm run ingest) primeiro."}
          </p>
        </div>
      ) : (
        <div className="leads-grid">
          {leads.map((b) => {
            const wa = whatsappUrl(b.phone1 || b.phone2);
            return (
              <div className="card lead-card" key={b.id}>
                <div>
                  <span className="score-pill">{b.score}</span>{" "}
                  <span className={`badge ${BADGE_CLASS[b.presenceClass]}`}>
                    {PRESENCE_LABEL[b.presenceClass]}
                  </span>
                </div>
                <Link className="name" href={`/app/leads/${b.id}`}>
                  {b.displayName || b.razaoSocial || "(sem nome)"}
                </Link>
                <div className="meta">
                  {b.cnae.label} · {groupLabel(b.cnae.group)}
                  <br />
                  {b.bairro}
                  {b.phone1 && (
                    <>
                      <br />
                      📞 {formatPhone(b.phone1)}
                    </>
                  )}
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: "auto" }}>
                  {wa && (
                    <a className="btn btn--sm" href={wa} target="_blank" rel="noopener noreferrer">
                      WhatsApp
                    </a>
                  )}
                  <a
                    className="btn btn--ghost btn--sm"
                    href={`/s/${demoSlug(b)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Ver demo ↗
                  </a>
                  <form action={setStatusAction}>
                    <input type="hidden" name="businessId" value={b.id} />
                    <input type="hidden" name="status" value="CONTATADO" />
                    <button className="btn btn--ghost btn--sm" type="submit">
                      Marcar {STATUS_LABEL.CONTATADO.toLowerCase()}
                    </button>
                  </form>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {pages > 1 && (
        <p style={{ marginTop: 20, textAlign: "center" }}>
          {page > 1 && (
            <Link href={buildPageHref(sp, page - 1)} style={{ marginRight: 16 }}>
              ← Anterior
            </Link>
          )}
          Página {page} de {pages}
          {page < pages && (
            <Link href={buildPageHref(sp, page + 1)} style={{ marginLeft: 16 }}>
              Próxima →
            </Link>
          )}
        </p>
      )}
    </main>
  );
}

function buildPageHref(sp: Record<string, string | undefined>, page: number): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (v && k !== "pagina") params.set(k, v);
  params.set("pagina", String(page));
  return `/app/leads?${params.toString()}`;
}
