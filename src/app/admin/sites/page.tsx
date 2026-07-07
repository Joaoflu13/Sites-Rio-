import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";
import Topbar from "@/components/Topbar";
import { createDemoSite, saveDemoSite } from "./actions";

const ERR: Record<string, string> = {
  cnpj: "CNPJ inválido (precisa dos 14 dígitos).",
  naoencontrado: "CNPJ não está na base — confira os dígitos.",
  slug: "Esse endereço (slug) já está em uso por outro site.",
};

// Sites dos clientes: ativa (cria DemoSite), edita conteúdo e publica.
export default async function AdminSitesPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; ok?: string; error?: string }>;
}) {
  await requireAdmin();
  const { edit, ok, error } = await searchParams;

  const sites = await prisma.demoSite.findMany({
    include: { business: { include: { cnae: true } } },
    orderBy: { updatedAt: "desc" },
  });
  const editing = edit ? sites.find((s) => s.id === edit) : null;

  return (
    <>
      <Topbar />
      <main className="page">
        <h1>Sites dos clientes</h1>
        <p className="muted">
          Toda demo já existe automaticamente em <code>/s/[slug]</code>. Ative aqui quando o
          cliente <strong>fechar</strong>: aí dá para personalizar o conteúdo, encurtar o
          endereço e <strong>publicar</strong> (remove a faixa de demonstração e libera o
          Google).
        </p>
        {ok && <p className="ok">{ok === "criado" ? "Site ativado — personalize abaixo." : "Salvo."}</p>}
        {error && <p className="error">{ERR[error] ?? "Não foi possível concluir."}</p>}

        <section className="card" style={{ marginBottom: 20 }}>
          <h2 style={{ marginTop: 0 }}>Ativar site de um cliente</h2>
          <form action={createDemoSite} className="filters">
            <div>
              <label htmlFor="cnpj">CNPJ do estabelecimento</label>
              <input id="cnpj" name="cnpj" placeholder="00.000.000/0000-00" required />
            </div>
            <div className="actions">
              <button className="btn" type="submit">
                Ativar
              </button>
            </div>
          </form>
        </section>

        {editing && (
          <section className="card" style={{ marginBottom: 20 }}>
            <h2 style={{ marginTop: 0 }}>
              Editando: {editing.business.displayName || editing.business.razaoSocial}
            </h2>
            <form action={saveDemoSite}>
              <input type="hidden" name="id" value={editing.id} />
              <div className="filters" style={{ marginBottom: 12 }}>
                <div>
                  <label htmlFor="slug">Endereço (slug) — /s/…</label>
                  <input id="slug" name="slug" defaultValue={editing.slug} required />
                </div>
                <div>
                  <label htmlFor="whatsapp">WhatsApp (só dígitos, com DDD)</label>
                  <input id="whatsapp" name="whatsapp" defaultValue={editing.whatsapp} />
                </div>
                <div>
                  <label htmlFor="instagram">Instagram (URL)</label>
                  <input id="instagram" name="instagram" defaultValue={editing.instagram} />
                </div>
                <div>
                  <label htmlFor="customDomain">Domínio próprio (ver README)</label>
                  <input id="customDomain" name="customDomain" defaultValue={editing.customDomain} placeholder="padariaestrela.com.br" />
                </div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <label htmlFor="headline">Frase de destaque (vazio = padrão do tema)</label>
                <input id="headline" name="headline" defaultValue={editing.headline} />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label htmlFor="about">Texto “Sobre nós” (vazio = padrão do tema)</label>
                <textarea id="about" name="about" rows={3} defaultValue={editing.about} />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label htmlFor="hours">Horário de funcionamento</label>
                <input id="hours" name="hours" defaultValue={editing.hours} placeholder="Seg–Sex 8h–18h · Sáb 8h–13h" />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600 }}>
                  <input
                    type="checkbox"
                    name="published"
                    defaultChecked={editing.published}
                    style={{ width: "auto" }}
                  />
                  Publicado (cliente pagante: remove a faixa de demonstração e libera indexação)
                </label>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button className="btn" type="submit">
                  Salvar
                </button>
                <a
                  className="btn btn--ghost"
                  href={`/s/${editing.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Ver site ↗
                </a>
              </div>
            </form>
          </section>
        )}

        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Endereço</th>
                <th>Status</th>
                <th>Domínio próprio</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sites.length === 0 && (
                <tr>
                  <td colSpan={5} className="muted">
                    Nenhum site ativado ainda — feche o primeiro cliente! 😄
                  </td>
                </tr>
              )}
              {sites.map((s) => (
                <tr key={s.id}>
                  <td>{s.business.displayName || s.business.razaoSocial}</td>
                  <td>
                    <a href={`/s/${s.slug}`} target="_blank" rel="noopener noreferrer">
                      /s/{s.slug}
                    </a>
                  </td>
                  <td>{s.published ? "✅ Publicado" : "🚧 Demo"}</td>
                  <td>{s.customDomain || "—"}</td>
                  <td>
                    <Link className="btn btn--ghost btn--sm" href={`/admin/sites?edit=${s.id}`}>
                      Editar
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}
