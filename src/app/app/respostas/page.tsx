import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSdrConfig } from "@/lib/sdr/run";
import { markHandledAction, sendBookingLinkAction } from "./actions";

export const dynamic = "force-dynamic";

const fmtDate = (d: Date) =>
  d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });

// Respostas humanas aos e-mails do assistente (SAIR, e-mail que voltou e férias
// são tratados sozinhos e não aparecem aqui). Pendentes primeiro.
export default async function RespostasPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; todas?: string }>;
}) {
  const { msg, todas } = await searchParams;
  const [cfg, rows] = await Promise.all([
    getSdrConfig(prisma),
    prisma.emailMessage.findMany({
      where: {
        direction: "IN",
        kind: "HUMAN",
        ...(todas ? { at: { gte: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) } } : { handledAt: null }),
      },
      include: { sequence: { include: { business: { select: { id: true, displayName: true, razaoSocial: true, bairro: true } } } } },
      orderBy: [{ at: "desc" }],
      take: 100,
    }),
  ]);

  return (
    <main className="page">
      <h1>Respostas aos e-mails</h1>
      <p className="muted">
        {todas ? (
          <>
            Últimos 60 dias. <Link href="/app/respostas">Ver só as pendentes</Link>
          </>
        ) : (
          <>
            Respostas que esperam você. <Link href="/app/respostas?todas=1">Ver também as já tratadas</Link>
          </>
        )}
      </p>
      {msg && (
        <div className="card" style={{ margin: "12px 0", borderColor: "#93c5fd", background: "#eff6ff" }}>
          {msg}
        </div>
      )}
      {!cfg.bookingUrl && (
        <p className="muted" style={{ fontSize: "0.85rem" }}>
          Para responder com o link da agenda em 1 clique, configure-o em Admin → Assistente.
        </p>
      )}

      {rows.length === 0 ? (
        <div className="card" style={{ marginTop: 12 }}>
          <p style={{ margin: 0 }}>Nenhuma resposta {todas ? "nos últimos 60 dias" : "pendente"}.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 14, marginTop: 12 }}>
          {rows.map((m) => {
            const b = m.sequence.business;
            const gmail = `https://mail.google.com/mail/u/0/#search/rfc822msgid%3A${encodeURIComponent(m.messageId.replace(/[<>]/g, ""))}`;
            return (
              <section className="card" key={m.id} style={m.handledAt ? { opacity: 0.65 } : undefined}>
                <p style={{ margin: "0 0 6px" }}>
                  <Link href={`/app/leads/${b.id}`}>
                    <strong>{b.displayName || b.razaoSocial}</strong>
                  </Link>{" "}
                  <span className="muted">
                    · {b.bairro} · {m.fromAddr} · {fmtDate(m.at)}
                    {m.handledAt && " · tratada"}
                  </span>
                </p>
                <p className="muted" style={{ margin: "0 0 8px", fontSize: "0.85rem" }}>
                  {m.subject}
                </p>
                <div style={{ whiteSpace: "pre-wrap", background: "#f8fafc", padding: 12, borderRadius: 8 }}>
                  {m.body || "(sem texto)"}
                </div>
                {!m.handledAt && (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                    {cfg.bookingUrl && (
                      <form action={sendBookingLinkAction}>
                        <input type="hidden" name="messageId" value={m.id} />
                        <button className="btn btn--sm" type="submit">
                          Enviar link da agenda
                        </button>
                      </form>
                    )}
                    <a className="btn btn--ghost btn--sm" href={gmail} target="_blank" rel="noopener noreferrer">
                      Responder no Gmail ↗
                    </a>
                    <form action={markHandledAction}>
                      <input type="hidden" name="messageId" value={m.id} />
                      <button className="btn btn--ghost btn--sm" type="submit">
                        Já respondi
                      </button>
                    </form>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
}
