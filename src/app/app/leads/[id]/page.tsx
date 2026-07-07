import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { groupLabel } from "@/lib/cnae";
import { formatPhone, PRESENCE_LABEL, STATUS_LABEL, whatsappUrl } from "@/lib/leads";
import type { Evidence } from "@/lib/classify";
import { demoSlug } from "@/lib/slug";
import { OFFER } from "@/lib/themes";
import CopyPitch from "@/components/CopyPitch";
import { setStatusAction } from "../actions";

// Detalhe do estabelecimento: contatos, evidências da verificação e CRM.
export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const b = await prisma.business.findUnique({
    where: { id },
    include: { cnae: true, prospection: { include: { updatedBy: true } }, demoSite: true },
  });
  if (!b) notFound();

  const evidence = (b.presenceEvidence ?? null) as Evidence | null;
  const wa = whatsappUrl(b.phone1 || b.phone2);
  const currentStatus = b.prospection?.status ?? "NOVO";

  const name = b.displayName || b.razaoSocial || "o estabelecimento";
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const demoUrl = `${appUrl}/s/${b.demoSite?.slug ?? demoSlug(b)}`;
  const pitch =
    `Olá! Fiz uma pesquisa no Google e vi que ${name} ainda não tem site próprio — ` +
    `quem procura acaba caindo no concorrente ou pagando comissão de aplicativo. ` +
    `Eu já deixei um site pronto para vocês, dá uma olhada: ${demoUrl} — ` +
    `se gostar, coloco no ar com endereço próprio por ${OFFER.setup} + ${OFFER.monthly}.`;

  return (
    <main className="page">
      <p>
        <Link href="/app/leads">← Fila de prospecção</Link>
      </p>
      <h1 style={{ marginBottom: 4 }}>{b.displayName || b.razaoSocial || "(sem nome)"}</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        <span className="score-pill">{b.score}</span>{" "}
        {PRESENCE_LABEL[b.presenceClass]} · {b.cnae.label} ({groupLabel(b.cnae.group)}) · dados de{" "}
        {b.ingestRef}
      </p>

      <div className="leads-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
        <section className="card">
          <h2 style={{ marginTop: 0 }}>Contato</h2>
          <p>
            <strong>Endereço:</strong> {b.street || "—"}
            <br />
            {b.bairro}
            {b.cep && ` · CEP ${b.cep}`}
          </p>
          <p>
            <strong>Telefone:</strong> {b.phone1 ? formatPhone(b.phone1) : "—"}
            {b.phone2 && ` / ${formatPhone(b.phone2)}`}
            <br />
            <strong>E-mail:</strong> {b.email || "—"}
          </p>
          <p className="muted" style={{ fontSize: "0.85rem" }}>
            Razão social: {b.razaoSocial || "—"}
            <br />
            CNPJ: {b.cnpj} {b.isMatriz ? "(matriz)" : "(filial)"}
            {b.openedAt && (
              <>
                <br />
                Em atividade desde {b.openedAt.getUTCFullYear()}
              </>
            )}
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {wa && (
              <a className="btn btn--sm" href={wa} target="_blank" rel="noopener noreferrer">
                Chamar no WhatsApp
              </a>
            )}
            {b.phone1 && (
              <a className="btn btn--ghost btn--sm" href={`tel:+55${b.phone1}`}>
                Ligar
              </a>
            )}
          </div>
        </section>

        <section className="card">
          <h2 style={{ marginTop: 0 }}>Presença web (evidências)</h2>
          {b.websiteUrl && (
            <p>
              <strong>Site encontrado:</strong>{" "}
              <a href={b.websiteUrl} target="_blank" rel="noopener noreferrer">
                {b.websiteUrl}
              </a>
            </p>
          )}
          {b.socialUrl && (
            <p>
              <strong>Rede social:</strong>{" "}
              <a href={b.socialUrl} target="_blank" rel="noopener noreferrer">
                {b.socialUrl}
              </a>
            </p>
          )}
          {evidence?.results?.length ? (
            <ul style={{ paddingLeft: 18, fontSize: "0.85rem" }}>
              {evidence.results.map((r, i) => (
                <li key={i}>
                  <a href={r.url} target="_blank" rel="noopener noreferrer">
                    {r.title || r.url}
                  </a>{" "}
                  <span className="muted">({r.matchedAs})</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">
              {b.presenceClass === "UNKNOWN"
                ? "Ainda não verificado — rode npm run enrich."
                : "Nenhum resultado registrado."}
            </p>
          )}
        </section>

        <section className="card">
          <h2 style={{ marginTop: 0 }}>Site demo 🚀</h2>
          <p className="muted" style={{ fontSize: "0.9rem" }}>
            O site de demonstração deste estabelecimento já está no ar — use-o na abordagem.
            {b.demoSite?.published && (
              <>
                {" "}
                <span className="ok">
                  <strong>Cliente ativo (publicado).</strong>
                </span>
              </>
            )}
          </p>
          <p style={{ wordBreak: "break-all", fontSize: "0.85rem" }}>
            <a href={demoUrl} target="_blank" rel="noopener noreferrer">
              {demoUrl}
            </a>
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <a className="btn btn--ghost btn--sm" href={demoUrl} target="_blank" rel="noopener noreferrer">
              Ver demo ↗
            </a>
            <CopyPitch text={pitch} />
          </div>
        </section>

        <section className="card">
          <h2 style={{ marginTop: 0 }}>CRM</h2>
          <p>
            Status atual: <span className="badge badge--status">{STATUS_LABEL[currentStatus]}</span>
            {b.prospection?.updatedBy && (
              <span className="muted" style={{ fontSize: "0.85rem" }}>
                {" "}
                (por {b.prospection.updatedBy.name})
              </span>
            )}
          </p>
          <form action={setStatusAction}>
            <input type="hidden" name="businessId" value={b.id} />
            <div style={{ marginBottom: 12 }}>
              <label htmlFor="status">Novo status</label>
              <select id="status" name="status" defaultValue={currentStatus}>
                {Object.entries(STATUS_LABEL).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label htmlFor="notes">Notas</label>
              <textarea
                id="notes"
                name="notes"
                rows={4}
                defaultValue={b.prospection?.notes ?? ""}
                placeholder="ex.: falei com a dona, pediu proposta por WhatsApp"
              />
            </div>
            <button className="btn" type="submit">
              Salvar
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
