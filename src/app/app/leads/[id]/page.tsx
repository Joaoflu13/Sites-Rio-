import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { groupLabel } from "@/lib/cnae";
import {
  followUpInputValue,
  formatPhone,
  phoneKind,
  PRESENCE_LABEL,
  STATUS_LABEL,
  whatsappUrl,
} from "@/lib/leads";
import type { Evidence } from "@/lib/classify";
import { demoSlug } from "@/lib/slug";
import { buildPitch } from "@/lib/pitch";
import CopyPitch from "@/components/CopyPitch";
import { CHANNEL_LABEL, demoLink, timeAgo } from "@/lib/tracking";
import { normalizeEmail } from "@/lib/emails";
import {
  enrollLeadAction,
  optOutAction,
  setStatusAction,
  stopSequenceAction,
  undoOptOutAction,
} from "../actions";

const SEQ_LABEL: Record<string, string> = {
  ACTIVE: "Na sequência",
  REPLIED: "Respondeu",
  FINISHED: "Terminou sem resposta",
  STOPPED: "Parada",
  BOUNCED: "E-mail voltou",
  OPTED_OUT: "Pediu para sair",
};
const KIND_LABEL: Record<string, string> = {
  HUMAN: "resposta",
  OPT_OUT: "pediu para sair",
  BOUNCE: "não entregue",
  AUTO_REPLY: "resposta automática",
};

// Detalhe do estabelecimento: contatos, evidências da verificação e CRM.
export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const b = await prisma.business.findUnique({
    where: { id },
    include: {
      cnae: true,
      prospection: { include: { updatedBy: true } },
      demoSite: true,
      demoViews: { orderBy: { at: "desc" }, take: 10 },
      emailSequence: { include: { messages: { orderBy: { at: "asc" } } } },
    },
  });
  if (!b) notFound();

  const evidence = (b.presenceEvidence ?? null) as Evidence | null;
  const wa = whatsappUrl(b.phone1, b.phone2);
  const callPhone = b.phone1 || b.phone2;
  const currentStatus = b.prospection?.status ?? "NOVO";

  const name = b.displayName || b.razaoSocial || "o estabelecimento";
  const slug = b.demoSite?.slug ?? demoSlug(b);
  const demoUrl = demoLink(slug);
  const optedOut = Boolean(b.optOutAt);
  // a mensagem leva o link marcado (?c=w): a visita aparece como "via WhatsApp"
  const pitch = buildPitch({
    name,
    presenceClass: b.presenceClass,
    websiteUrl: b.websiteUrl,
    demoUrl: demoLink(slug, "w"),
  });

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

      {optedOut && (
        <div className="card" style={{ borderColor: "#fca5a5", background: "#fef2f2", marginBottom: 16 }}>
          <p style={{ margin: 0 }}>
            <span className="badge badge--optout">Não contatar</span> Pediu para não receber contato em{" "}
            {b.optOutAt!.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })} (LGPD). Saiu da fila, dos
            exports e da demo pública{b.email ? "; o e-mail está na lista de supressão" : ""}.
          </p>
          <form action={undoOptOutAction} style={{ marginTop: 10 }}>
            <input type="hidden" name="businessId" value={b.id} />
            <button className="btn btn--ghost btn--sm" type="submit">
              Desfazer (marcado por engano)
            </button>
          </form>
        </div>
      )}

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
            <strong>Telefone:</strong>{" "}
            {[b.phone1, b.phone2].filter(Boolean).length
              ? [b.phone1, b.phone2]
                  .filter(Boolean)
                  .map((p) => `${formatPhone(p)} (${phoneKind(p).toLowerCase()})`)
                  .join(" / ")
              : "—"}
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
          <div style={{ display: optedOut ? "none" : "flex", gap: 8, flexWrap: "wrap" }}>
            {wa && (
              <a className="btn btn--sm" href={wa} target="_blank" rel="noopener noreferrer">
                Chamar no WhatsApp
              </a>
            )}
            {!wa && callPhone && (
              <span className="muted" style={{ fontSize: "0.85rem", alignSelf: "center" }}>
                Sem celular no cadastro — só ligação.
              </span>
            )}
            {callPhone && (
              <a className={`btn btn--sm${wa ? " btn--ghost" : ""}`} href={`tel:+55${callPhone}`}>
                Ligar
              </a>
            )}
          </div>
        </section>

        <section className="card">
          <h2 style={{ marginTop: 0 }}>Presença web (evidências)</h2>
          {b.websiteUrl && (
            <p>
              <strong>
                {b.presenceClass === "WEAK_SITE" ? "Site grátis encontrado:" : "Site encontrado:"}
              </strong>{" "}
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
            {!optedOut && <CopyPitch text={pitch} />}
          </div>

          <h3 style={{ margin: "18px 0 6px", fontSize: "1rem" }}>Visitas do lead à demo</h3>
          {b.demoViewCount === 0 ? (
            <p className="muted" style={{ fontSize: "0.85rem", margin: 0 }}>
              Ainda não abriu. Visitas da equipe logada e de robôs de pré-visualização não contam.
            </p>
          ) : (
            <>
              <p style={{ margin: "0 0 6px" }}>
                <span className="badge badge--viewed">👀 {b.demoViewCount} visita(s)</span> · última{" "}
                {timeAgo(b.demoLastViewAt!)}
              </p>
              <ul style={{ paddingLeft: 18, margin: 0, fontSize: "0.85rem" }}>
                {b.demoViews.map((v) => (
                  <li key={v.id}>
                    {v.at.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" })}
                    {v.channel && <span className="muted"> · via {CHANNEL_LABEL[v.channel] ?? v.channel}</span>}
                  </li>
                ))}
              </ul>
            </>
          )}
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
              <label htmlFor="nextFollowUpAt">Próximo retorno</label>
              <input
                id="nextFollowUpAt"
                name="nextFollowUpAt"
                type="date"
                defaultValue={followUpInputValue(b.prospection?.nextFollowUpAt)}
              />
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

          {!optedOut && (
            <form action={optOutAction} style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
              <input type="hidden" name="businessId" value={b.id} />
              <p className="muted" style={{ fontSize: "0.85rem", margin: "0 0 8px" }}>
                Respondeu SAIR ou pediu para não ser contatado? Isso tira o lead da fila, dos exports e da
                demo pública{b.email ? " e bloqueia o e-mail em todos os CNPJs" : ""}.
              </p>
              <button className="btn btn--ghost btn--sm" type="submit">
                Pediu para não ser contatado (LGPD)
              </button>
            </form>
          )}
        </section>

        <section className="card">
          <h2 style={{ marginTop: 0 }}>Assistente de e-mail</h2>
          {b.emailSequence ? (
            <>
              <p style={{ margin: "0 0 8px" }}>
                <span className="badge badge--status">{SEQ_LABEL[b.emailSequence.status]}</span>{" "}
                <span className="muted" style={{ fontSize: "0.85rem" }}>
                  {b.emailSequence.email} · {b.emailSequence.step} de 3 e-mails
                  {b.emailSequence.status === "ACTIVE" &&
                    ` · próximo em ${b.emailSequence.nextSendAt.toLocaleString("pt-BR", {
                      timeZone: "America/Sao_Paulo",
                      dateStyle: "short",
                      timeStyle: "short",
                    })}`}
                </span>
              </p>
              {b.emailSequence.messages.length > 0 && (
                <ul style={{ paddingLeft: 18, margin: "0 0 8px", fontSize: "0.85rem" }}>
                  {b.emailSequence.messages.map((m) => (
                    <li key={m.id}>
                      {m.at.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" })}{" "}
                      {m.direction === "OUT" ? (m.step ? `→ e-mail ${m.step}` : "→ resposta enviada") : `← ${KIND_LABEL[m.kind ?? "HUMAN"]}`}
                      {m.direction === "IN" && m.body && (
                        <div className="muted" style={{ whiteSpace: "pre-wrap" }}>
                          {m.body.slice(0, 300)}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {b.emailSequence.status === "ACTIVE" && (
                <form action={stopSequenceAction}>
                  <input type="hidden" name="businessId" value={b.id} />
                  <button className="btn btn--ghost btn--sm" type="submit">
                    Parar sequência
                  </button>
                </form>
              )}
            </>
          ) : optedOut || !normalizeEmail(b.email) ? (
            <p className="muted" style={{ margin: 0, fontSize: "0.9rem" }}>
              {optedOut ? "Lead pediu para não ser contatado." : "Sem e-mail válido no cadastro."}
            </p>
          ) : (
            <form action={enrollLeadAction}>
              <input type="hidden" name="businessId" value={b.id} />
              <p className="muted" style={{ fontSize: "0.85rem", margin: "0 0 8px" }}>
                O assistente manda até 3 e-mails para {b.email} (D0, D3, D7) e para sozinho se houver resposta.
              </p>
              <button className="btn btn--sm" type="submit">
                Colocar na sequência de e-mail
              </button>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
