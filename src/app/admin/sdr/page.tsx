import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { CNAE_GROUPS } from "@/lib/cnae";
import { PRESENCE_LABEL } from "@/lib/leads";
import { mailerFromEnv } from "@/lib/sdr/mailer";
import { getSdrConfig } from "@/lib/sdr/run";
import { dailyCap, inSendingWindow, startOfDayBRT } from "@/lib/sdr/schedule";
import Topbar from "@/components/Topbar";
import { enrollBatchAction, runNowAction, saveSdrConfigAction, sendTestAction, toggleSdrAction } from "./actions";

export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;
const fmtDate = (d: Date) =>
  d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });

// Painel do assistente de vendas por e-mail: estado, segurança, configuração,
// inscrição de leads e o que vai sair a seguir.
export default async function SdrPage({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  await requireAdmin();
  const { msg } = await searchParams;
  const now = new Date();
  const mailer = mailerFromEnv();
  const cfg = await getSdrConfig(prisma);
  const weekAgo = new Date(now.getTime() - 7 * DAY_MS);

  const [byStatus, sentToday, outs7, bounces7, pending, queue, recent, bairros] = await Promise.all([
    prisma.emailSequence.groupBy({ by: ["status"], _count: true }),
    prisma.emailMessage.count({ where: { direction: "OUT", at: { gte: startOfDayBRT(now) } } }),
    prisma.emailMessage.count({ where: { direction: "OUT", at: { gte: weekAgo } } }),
    prisma.emailMessage.count({ where: { direction: "IN", kind: "BOUNCE", at: { gte: weekAgo } } }),
    prisma.emailMessage.count({ where: { direction: "IN", kind: "HUMAN", handledAt: null } }),
    prisma.emailSequence.findMany({
      where: { status: "ACTIVE" },
      include: { business: { select: { id: true, displayName: true, razaoSocial: true, bairro: true } } },
      orderBy: [{ nextSendAt: "asc" }],
      take: 15,
    }),
    prisma.emailMessage.findMany({
      where: { direction: "OUT" },
      include: { sequence: { include: { business: { select: { id: true, displayName: true } } } } },
      orderBy: { at: "desc" },
      take: 10,
    }),
    prisma.business.groupBy({ by: ["bairro"], _count: true, orderBy: { _count: { bairro: "desc" } }, take: 200 }),
  ]);
  const count = (s: string) => byStatus.find((r) => r.status === s)?._count ?? 0;
  const cap = dailyCap(cfg.rampStartedAt, now, cfg.dailyCapMax);
  const rampWeek = cfg.rampStartedAt ? Math.floor((now.getTime() - cfg.rampStartedAt.getTime()) / (7 * DAY_MS)) + 1 : 0;
  const state = cfg.enabled ? "Ligado" : cfg.pausedReason ? "Pausado" : "Desligado";
  const cronReady = Boolean(process.env.CRON_SECRET);

  return (
    <>
      <Topbar />
      <main className="page">
        <p>
          <Link href="/admin">← Admin</Link>
        </p>
        <h1>Assistente de vendas (e-mail)</h1>
        <p className="muted">
          Manda até 3 e-mails por lead (D0, D3, D7) da caixa {mailer.configured ? <strong>{mailer.address}</strong> : "configurada no .env"},
          só em dias úteis das 8h às 18h, com intervalo aleatório. Qualquer resposta para a sequência: SAIR vira opt-out,
          e-mail que volta é bloqueado, férias adiam, e o resto vai para{" "}
          <Link href="/app/respostas">Respostas</Link>.
        </p>

        {msg && (
          <div className="card" style={{ margin: "12px 0", borderColor: "#93c5fd", background: "#eff6ff" }}>
            {msg}
          </div>
        )}

        {(!mailer.configured || !cronReady) && (
          <div className="card" style={{ margin: "12px 0", borderColor: "#fcd34d", background: "#fffbeb" }}>
            <strong>Falta configurar:</strong>
            <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
              {!mailer.configured && (
                <li>
                  <code>SDR_EMAIL</code> e <code>SDR_APP_PASSWORD</code> (senha de app do Google Workspace) — sem eles, nada
                  é enviado (modo simulação).
                </li>
              )}
              {!cronReady && (
                <li>
                  <code>CRON_SECRET</code> + agendador externo chamando <code>/api/cron/sdr</code> a cada 5 min — sem ele, o
                  assistente só roda no botão &quot;Rodar agora&quot;.
                </li>
              )}
            </ul>
          </div>
        )}

        <div className="stat-tiles">
          <div className="card tile">
            <div className="num" style={{ color: cfg.enabled ? "var(--ok)" : cfg.pausedReason ? "var(--error)" : undefined }}>
              {state}
            </div>
            <div className="label">{cfg.enabled && !inSendingWindow(now) ? "fora do horário agora" : "estado"}</div>
          </div>
          <div className="card tile">
            <div className="num">
              {sentToday}/{cap}
            </div>
            <div className="label">Enviados hoje {rampWeek ? `(aquecimento: semana ${rampWeek})` : ""}</div>
          </div>
          <div className="card tile">
            <div className="num">{count("ACTIVE")}</div>
            <div className="label">Na sequência</div>
          </div>
          <Link href="/app/respostas" className="card tile">
            <div className="num">{pending}</div>
            <div className="label">Respostas esperando você</div>
          </Link>
          <div className="card tile">
            <div className="num" style={{ color: outs7 && bounces7 / outs7 > 0.03 ? "var(--error)" : undefined }}>
              {outs7 ? `${((bounces7 / outs7) * 100).toFixed(1).replace(".", ",")}%` : "—"}
            </div>
            <div className="label">E-mails que voltaram (7 dias)</div>
          </div>
        </div>

        {cfg.pausedReason && !cfg.enabled && (
          <div className="card" style={{ margin: "12px 0", borderColor: "#fca5a5", background: "#fef2f2" }}>
            <strong>Pausado automaticamente:</strong> {cfg.pausedReason}
          </div>
        )}

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", margin: "8px 0 4px" }}>
          <form action={toggleSdrAction}>
            <button className={`btn${cfg.enabled ? " btn--ghost" : ""}`} type="submit">
              {cfg.enabled ? "Desligar assistente" : "Ligar assistente"}
            </button>
          </form>
          <form action={runNowAction}>
            <button className="btn btn--ghost" type="submit">
              Rodar agora
            </button>
          </form>
        </div>
        <p className="muted" style={{ fontSize: "0.85rem" }}>
          Respondidos: {count("REPLIED")} · sem resposta (3 e-mails): {count("FINISHED")} · SAIR: {count("OPTED_OUT")} ·
          voltaram: {count("BOUNCED")} · parados: {count("STOPPED")}
          {cfg.lastRunAt && <> · última execução {fmtDate(cfg.lastRunAt)}</>}
          {cfg.lastError && <span className="error"> · último erro: {cfg.lastError}</span>}
        </p>

        <div className="leads-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", marginTop: 16 }}>
          <section className="card">
            <h2 style={{ marginTop: 0 }}>Configuração</h2>
            <form action={saveSdrConfigAction}>
              <label htmlFor="bookingUrl">Link da agenda (Cal.com ou Google Agenda)</label>
              <input id="bookingUrl" name="bookingUrl" defaultValue={cfg.bookingUrl} placeholder="https://cal.com/seu-nome/15min" />
              <p className="muted" style={{ fontSize: "0.8rem", margin: "4px 0 12px" }}>
                Aparece como botão &quot;Agendar 15 min&quot; nas demos e vai na resposta com 1 clique.
              </p>
              <label htmlFor="dailyCapMax">Máximo de e-mails por dia (depois do aquecimento)</label>
              <input id="dailyCapMax" name="dailyCapMax" type="number" min={1} max={100} defaultValue={cfg.dailyCapMax} />
              <p className="muted" style={{ fontSize: "0.8rem", margin: "4px 0 12px" }}>
                Aquecimento automático: 10/dia na 1ª semana, 20 na 2ª, 30 na 3ª, depois este máximo.
              </p>
              <button className="btn" type="submit">
                Salvar
              </button>
            </form>
          </section>

          <section className="card">
            <h2 style={{ marginTop: 0 }}>Testar antes de ligar</h2>
            <p className="muted" style={{ fontSize: "0.9rem" }}>
              Manda para você o 1º e-mail de um lead real, exatamente como ele receberia (com [TESTE] no assunto).
            </p>
            <form action={sendTestAction}>
              <label htmlFor="to">Seu e-mail</label>
              <input id="to" name="to" type="email" placeholder="voce@gmail.com" required />
              <button className="btn btn--ghost" type="submit" style={{ marginTop: 10 }}>
                Enviar teste
              </button>
            </form>
          </section>
        </div>

        <h2 style={{ marginTop: 28 }}>Colocar leads na sequência</h2>
        <p className="muted">
          Mesmos critérios do lote CSV: maior score primeiro, um lead por e-mail, sem contador, supressão, opt-out ou quem
          já está no CRM. O lead vai para &quot;Contatado&quot; no pipeline.
        </p>
        <form className="card filters" action={enrollBatchAction} style={{ marginTop: 12 }}>
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
            <label htmlFor="limit">Quantos</label>
            <input id="limit" name="limit" type="number" min={1} max={200} defaultValue={20} />
          </div>
          <div style={{ minWidth: "100%" }}>
            <label style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 400 }}>
              <input type="checkbox" name="ownDomainOnly" style={{ width: "auto" }} /> Só e-mails de domínio próprio (sem
              Gmail/Hotmail)
            </label>
          </div>
          <div className="actions">
            <button className="btn" type="submit" style={{ whiteSpace: "nowrap" }}>
              Colocar na sequência
            </button>
          </div>
        </form>

        <div className="leads-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", marginTop: 24 }}>
          <section className="card">
            <h2 style={{ marginTop: 0 }}>Próximos envios</h2>
            {queue.length === 0 ? (
              <p className="muted">Ninguém na sequência.</p>
            ) : (
              <ul style={{ paddingLeft: 18, margin: 0, fontSize: "0.9rem" }}>
                {queue.map((q) => (
                  <li key={q.id}>
                    <Link href={`/app/leads/${q.business.id}`}>{q.business.displayName || q.business.razaoSocial}</Link>{" "}
                    <span className="muted">
                      · e-mail {q.step + 1} de 3 · {q.nextSendAt <= now ? "na vez" : fmtDate(q.nextSendAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="card">
            <h2 style={{ marginTop: 0 }}>Últimos enviados</h2>
            {recent.length === 0 ? (
              <p className="muted">Nada enviado ainda.</p>
            ) : (
              <ul style={{ paddingLeft: 18, margin: 0, fontSize: "0.9rem" }}>
                {recent.map((m) => (
                  <li key={m.id}>
                    <Link href={`/app/leads/${m.sequence.business.id}`}>{m.sequence.business.displayName}</Link>{" "}
                    <span className="muted">
                      · {m.step ? `e-mail ${m.step}` : "resposta"} · {fmtDate(m.at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </main>
    </>
  );
}
