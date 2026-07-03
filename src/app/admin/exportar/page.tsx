import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { CNAE_GROUPS } from "@/lib/cnae";
import { PRESENCE_LABEL } from "@/lib/leads";
import Topbar from "@/components/Topbar";

// Fase 0: o dono filtra e baixa a lista em CSV para vender manualmente.
export default async function ExportarPage() {
  await requireAdmin();

  const bairros = await prisma.business.groupBy({
    by: ["bairro"],
    _count: true,
    orderBy: { _count: { bairro: "desc" } },
    take: 200,
  });

  return (
    <>
      <Topbar />
      <main className="page">
        <h1>Exportar lista (CSV)</h1>
        <p className="muted">
          O arquivo inclui todos os dados (CNPJ, contatos, evidências) — uso interno/venda manual.
        </p>
        <form className="card filters" action="/api/admin/export" method="GET" style={{ marginTop: 16 }}>
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
              <option value="">Todas</option>
              {Object.entries(PRESENCE_LABEL).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="minScore">Score mínimo</label>
            <input id="minScore" name="minScore" type="number" min={0} max={100} placeholder="0" />
          </div>
          <div className="actions">
            <button className="btn" type="submit">
              Baixar CSV
            </button>
          </div>
        </form>
      </main>
    </>
  );
}
