// Motor do assistente de vendas (SDR). Uma execução (cron a cada ~5 min):
//   1. lê a caixa de entrada e trata as respostas (sempre, mesmo desligado);
//   2. envia NO MÁXIMO um e-mail, se estiver ligado, no horário, abaixo do
//      limite do dia e depois do intervalo aleatório desde o último envio.
// Tudo que é decisão fica em funções puras (schedule.ts, replies.ts, templates.ts).

import type { Prisma, PrismaClient, ReplyKind } from "@prisma/client";
import { simpleParser } from "mailparser";
import { normalizeEmail } from "@/lib/emails";
import { followUpInputValue, parseFollowUpDate } from "@/lib/leads";
import { applyOptOut, optOutNote } from "@/lib/optout";
import { demoSlug } from "@/lib/slug";
import { demoLink } from "@/lib/tracking";
import type { SdrMailer } from "./mailer";
import { sdrOwnerName } from "./mailer";
import { classifyReply, newMessageId, ourMessageIds, stripQuoted } from "./replies";
import { dailyCap, inSendingWindow, nextStepAt, sendGapMs, startOfDayBRT } from "./schedule";
import { bookingReply, sequenceEmail } from "./templates";

const DAY_MS = 24 * 60 * 60 * 1000;
/** Pausa automática: mais de 3% de e-mails voltando (com pelo menos 30 enviados em 7 dias). */
const BOUNCE_PAUSE_RATE = 0.03;
const BOUNCE_MIN_SAMPLE = 30;

export type InboxResult = { read: number; matched: number } & Record<ReplyKind, number>;
export type RunResult = { inbox: InboxResult; sent: { to: string; step: number } | null; skipped: string; error: string };

export async function getSdrConfig(prisma: PrismaClient) {
  return prisma.sdrConfig.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
}

export async function runSdr(
  prisma: PrismaClient,
  mailer: SdrMailer,
  now: Date = new Date(),
  rand: () => number = Math.random
): Promise<RunResult> {
  const result: RunResult = {
    inbox: { read: 0, matched: 0, HUMAN: 0, OPT_OUT: 0, BOUNCE: 0, AUTO_REPLY: 0 },
    sent: null,
    skipped: "",
    error: "",
  };
  let cfg = await getSdrConfig(prisma);

  try {
    result.inbox = await processInbox(prisma, mailer, cfg, now);
  } catch (e) {
    result.error = `caixa de entrada: ${(e as Error).message}`;
  }

  try {
    cfg = await getSdrConfig(prisma); // a leitura pode ter mudado algo (ex.: pausa)
    const s = await sendNext(prisma, mailer, cfg, now, rand);
    result.sent = s.sent;
    result.skipped = s.skipped;
  } catch (e) {
    result.error = [result.error, `envio: ${(e as Error).message}`].filter(Boolean).join(" · ");
  }

  await prisma.sdrConfig.update({
    where: { id: 1 },
    data: { lastRunAt: now, ...(result.error ? { lastError: result.error.slice(0, 500) } : {}) },
  });
  return result;
}

// ---------------------------------------------------------------- caixa de entrada

async function processInbox(
  prisma: PrismaClient,
  mailer: SdrMailer,
  cfg: { imapUidValidity: bigint | null; imapLastUid: number },
  now: Date
): Promise<InboxResult> {
  const out: InboxResult = { read: 0, matched: 0, HUMAN: 0, OPT_OUT: 0, BOUNCE: 0, AUTO_REPLY: 0 };
  if (!mailer.configured) return out;

  const res = await mailer.fetchNew({ uidValidity: cfg.imapUidValidity, lastUid: cfg.imapLastUid });
  for (const m of res.messages) {
    out.read++;
    try {
      const kind = await handleInbound(prisma, mailer.address, m.raw, `${res.uidValidity}.${m.uid}`, now);
      if (kind) {
        out.matched++;
        out[kind]++;
      }
    } catch (e) {
      // um e-mail problemático não trava a fila; o próximo ciclo segue do UID seguinte
      console.error(`[sdr] erro ao tratar UID ${m.uid}:`, (e as Error).message);
    }
  }
  await prisma.sdrConfig.update({
    where: { id: 1 },
    data: { imapUidValidity: res.uidValidity, imapLastUid: res.lastUid },
  });
  return out;
}

/** Trata um e-mail recebido. Devolve o tipo, ou null se não é resposta à sequência. */
export async function handleInbound(
  prisma: PrismaClient,
  ownAddress: string,
  raw: Buffer,
  fallbackKey: string,
  now: Date
): Promise<ReplyKind | null> {
  const parsed = await simpleParser(raw);
  const from = normalizeEmail(parsed.from?.value[0]?.address);
  if (from && from === ownAddress) return null;

  // 1º pelo Message-ID que o assistente gerou (respostas e avisos de não entrega);
  // 2º pelo remetente (cliente de e-mail que não mantém o cabeçalho da conversa)
  // texto decodificado + anexos: no aviso de não entrega o Message-ID original vem
  // num anexo (message/rfc822-headers) ou em quoted-printable, partido por "=\n"
  const haystack = [
    raw.toString("latin1"),
    parsed.text ?? "",
    ...parsed.attachments.map((a) => a.content.toString("utf8")),
  ].join("\n");
  const ids = ourMessageIds(haystack);
  let seq = ids.length
    ? (await prisma.emailMessage.findFirst({ where: { messageId: { in: ids }, direction: "OUT" }, include: { sequence: true } }))
        ?.sequence ?? null
    : null;
  if (!seq && from) {
    seq = await prisma.emailSequence.findFirst({ where: { email: from }, orderBy: { createdAt: "desc" } });
  }
  if (!seq) return null;

  const messageId = parsed.messageId || `<in.${fallbackKey}@local>`;
  if (await prisma.emailMessage.findUnique({ where: { messageId } })) return null; // já tratado

  const headers: Record<string, string> = {};
  for (const h of parsed.headerLines) headers[h.key.toLowerCase()] = h.line.slice(h.line.indexOf(":") + 1).trim();
  const text = parsed.text ?? "";
  const subject = parsed.subject ?? "";
  const kind = classifyReply({ from, subject, headers, text, contentType: headers["content-type"] });

  await prisma.emailMessage.create({
    data: {
      sequenceId: seq.id,
      direction: "IN",
      messageId,
      subject: subject.slice(0, 300),
      fromAddr: from,
      body: (kind === "BOUNCE" ? text : stripQuoted(text)).slice(0, 4000),
      kind,
      at: now,
      handledAt: kind === "HUMAN" ? null : now, // só resposta humana espera por você
    },
  });

  const day = now.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  if (kind === "BOUNCE") {
    await prisma.$transaction([
      prisma.emailSequence.update({ where: { id: seq.id }, data: { status: "BOUNCED", endedAt: seq.endedAt ?? now } }),
      prisma.suppressedEmail.upsert({
        where: { email: seq.email },
        update: {},
        create: { email: seq.email, reason: "E-mail não entregue (voltou)" },
      }),
    ]);
    await appendNote(prisma, seq.businessId, `E-mail ${seq.email} voltou (não entregue) em ${day}.`);
  } else if (kind === "OPT_OUT") {
    await applyOptOut(prisma, seq.businessId, {
      note: optOutNote("Respondeu ao assistente pedindo para sair"),
      extraEmail: from,
    });
    await prisma.emailSequence.update({ where: { id: seq.id }, data: { status: "OPTED_OUT", endedAt: seq.endedAt ?? now } });
  } else if (kind === "AUTO_REPLY") {
    if (seq.status === "ACTIVE") {
      const later = new Date(now.getTime() + 7 * DAY_MS);
      await prisma.emailSequence.update({
        where: { id: seq.id },
        data: { nextSendAt: seq.nextSendAt > later ? seq.nextSendAt : later },
      });
    }
  } else {
    if (seq.status === "ACTIVE" || seq.status === "FINISHED") {
      await prisma.emailSequence.update({ where: { id: seq.id }, data: { status: "REPLIED", endedAt: now } });
    }
    // retorno para HOJE: aparece em "Retornos p/ hoje" no pipeline
    await appendNote(prisma, seq.businessId, `Respondeu o e-mail do assistente em ${day} — ver aba Respostas.`, {
      nextFollowUpAt: parseFollowUpDate(followUpInputValue(now)),
    });
  }
  return kind;
}

async function appendNote(
  prisma: PrismaClient,
  businessId: string,
  note: string,
  extra: Prisma.ProspectionUpdateInput = {}
) {
  const p = await prisma.prospection.findUnique({ where: { businessId } });
  if (p) {
    await prisma.prospection.update({
      where: { businessId },
      data: { notes: [p.notes, note].filter(Boolean).join("\n"), ...extra },
    });
  } else {
    await prisma.prospection.create({
      data: {
        businessId,
        status: "CONTATADO",
        notes: note,
        nextFollowUpAt: (extra.nextFollowUpAt as Date | null | undefined) ?? null,
      },
    });
  }
}

// ---------------------------------------------------------------- envio

type SendOutcome = { sent: { to: string; step: number } | null; skipped: string };

async function sendNext(
  prisma: PrismaClient,
  mailer: SdrMailer,
  cfg: Awaited<ReturnType<typeof getSdrConfig>>,
  now: Date,
  rand: () => number
): Promise<SendOutcome> {
  const skip = (skipped: string): SendOutcome => ({ sent: null, skipped });
  if (!cfg.enabled) return skip(cfg.pausedReason ? `pausado: ${cfg.pausedReason}` : "desligado");
  // sem caixa, "enviar" em simulação avançaria a sequência sem o lead receber nada
  if (!mailer.configured && !dryRunAllowed()) return skip("caixa não configurada (SDR_EMAIL / SDR_APP_PASSWORD)");
  if (!inSendingWindow(now)) return skip("fora do horário (dias úteis, 8h–18h)");

  // trava de segurança: muitos e-mails voltando = lista ruim ou domínio queimando
  const weekAgo = new Date(now.getTime() - 7 * DAY_MS);
  const [outs, bounces] = await Promise.all([
    prisma.emailMessage.count({ where: { direction: "OUT", at: { gte: weekAgo } } }),
    prisma.emailMessage.count({ where: { direction: "IN", kind: "BOUNCE", at: { gte: weekAgo } } }),
  ]);
  if (outs >= BOUNCE_MIN_SAMPLE && bounces / outs > BOUNCE_PAUSE_RATE) {
    const reason = `${bounces} de ${outs} e-mails voltaram em 7 dias (acima de 3%). Revise a lista antes de religar.`;
    await prisma.sdrConfig.update({ where: { id: 1 }, data: { enabled: false, pausedReason: reason } });
    return skip(`pausado: ${reason}`);
  }

  const cap = dailyCap(cfg.rampStartedAt, now, cfg.dailyCapMax);
  const sentToday = await prisma.emailMessage.count({ where: { direction: "OUT", at: { gte: startOfDayBRT(now) } } });
  if (sentToday >= cap) return skip(`limite do dia atingido (${sentToday}/${cap})`);
  if (cfg.nextSendNotBefore && cfg.nextSendNotBefore > now) return skip("aguardando o intervalo entre envios");

  // follow-ups antes de abordagens novas; quem não pode mais receber é parado aqui
  const seq = await pickSendable(prisma, now);
  if (!seq) return skip("nada para enviar agora");

  // reserva o horário (evita envio duplo se duas execuções coincidirem)
  const claimed = await prisma.sdrConfig.updateMany({
    where: { id: 1, OR: [{ nextSendNotBefore: null }, { nextSendNotBefore: { lte: now } }] },
    data: { nextSendNotBefore: new Date(now.getTime() + sendGapMs(rand())) },
  });
  if (claimed.count === 0) return skip("aguardando o intervalo entre envios");

  const b = seq.business;
  const step = seq.step + 1;
  const mail = sequenceEmail(
    step,
    {
      name: b.displayName || b.razaoSocial,
      presenceClass: b.presenceClass,
      websiteUrl: b.websiteUrl,
      demoUrl: demoLink(b.demoSite?.slug ?? demoSlug(b), "e"),
      ownerName: sdrOwnerName(),
    },
    seq.subject
  );
  const messageId = newMessageId(seq.id, step, mailer.address.split("@")[1] ?? "local", rand().toString(36).slice(2));
  const references = [...new Set([seq.firstMessageId, seq.lastMessageId].filter(Boolean))];

  await mailer.send({
    to: seq.email,
    subject: mail.subject,
    text: mail.text,
    messageId,
    inReplyTo: seq.lastMessageId || undefined,
    references: references.length ? references : undefined,
  });

  const next = nextStepAt(step, now);
  await prisma.$transaction([
    prisma.emailMessage.create({
      data: { sequenceId: seq.id, direction: "OUT", step, messageId, subject: mail.subject, fromAddr: mailer.address, body: mail.text, at: now },
    }),
    prisma.emailSequence.update({
      where: { id: seq.id },
      data: {
        step,
        lastMessageId: messageId,
        ...(step === 1 ? { subject: mail.subject, firstMessageId: messageId } : {}),
        ...(next ? { nextSendAt: next } : { status: "FINISHED", endedAt: now }),
      },
    }),
  ]);
  if (!next) {
    await appendNote(
      prisma,
      seq.businessId,
      `Sequência do assistente terminou sem resposta (${step} e-mails) em ${now.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}.`
    );
  }
  return { sent: { to: seq.email, step }, skipped: "" };
}

/** Simulação de envio só com SDR_DRY_RUN=1 (testes locais) — nunca por acidente em produção. */
function dryRunAllowed(): boolean {
  return process.env.SDR_DRY_RUN === "1";
}

const sendableInclude = { business: { include: { demoSite: true, prospection: true } } } as const;

async function pickSendable(prisma: PrismaClient, now: Date) {
  for (let i = 0; i < 20; i++) {
    const seq = await prisma.emailSequence.findFirst({
      where: { status: "ACTIVE", nextSendAt: { lte: now } },
      include: sendableInclude,
      orderBy: [{ step: "desc" }, { nextSendAt: "asc" }],
    });
    if (!seq) return null;
    const reason = await blockReason(prisma, seq);
    if (!reason) return seq;
    await prisma.emailSequence.update({ where: { id: seq.id }, data: { status: "STOPPED", endedAt: now } });
    console.log(`[sdr] sequência ${seq.id} parada: ${reason}`);
  }
  return null;
}

/** Motivo para NÃO mandar mais nada a este lead (ou null). */
async function blockReason(
  prisma: PrismaClient,
  seq: Prisma.EmailSequenceGetPayload<{ include: typeof sendableInclude }>
): Promise<string | null> {
  if (seq.business.optOutAt) return "lead pediu para sair";
  if (await prisma.suppressedEmail.findUnique({ where: { email: seq.email } })) return "e-mail na supressão";
  const p = seq.business.prospection;
  if (p && p.status !== "CONTATADO") return `CRM em "${p.status}" (alguém já assumiu)`;
  return null;
}

// ---------------------------------------------------------------- inscrição e ações manuais

/** Coloca leads na sequência (status ACTIVE, 1º e-mail no próximo ciclo) e registra no CRM. */
export async function enrollLeads(
  prisma: PrismaClient,
  leads: { businessId: string; email: string }[],
  userId: string | null,
  now: Date = new Date()
): Promise<number> {
  if (!leads.length) return 0;
  const day = now.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const created = await prisma.emailSequence.createMany({
    data: leads.map((l) => ({ businessId: l.businessId, email: l.email, nextSendAt: now, createdById: userId })),
    skipDuplicates: true,
  });
  await prisma.prospection.createMany({
    data: leads.map((l) => ({
      businessId: l.businessId,
      status: "CONTATADO" as const,
      notes: `Na sequência de e-mail do assistente desde ${day}.`,
      updatedById: userId,
    })),
    skipDuplicates: true,
  });
  return created.count;
}

/** "Enviar link da agenda" (aba Respostas): responde na mesma conversa e marca como tratada. */
export async function sendBookingLink(
  prisma: PrismaClient,
  mailer: SdrMailer,
  inboundId: string,
  userId: string,
  now: Date = new Date()
): Promise<string | null> {
  const cfg = await getSdrConfig(prisma);
  if (!cfg.bookingUrl) return "Configure o link da agenda em Admin → Assistente.";
  if (!mailer.configured && !dryRunAllowed()) return "Caixa do assistente não configurada (SDR_EMAIL / SDR_APP_PASSWORD).";
  const msg = await prisma.emailMessage.findUnique({ where: { id: inboundId }, include: { sequence: true } });
  if (!msg || msg.direction !== "IN") return "Resposta não encontrada.";
  const seq = msg.sequence;
  const subjectBase = seq.subject || msg.subject.replace(/^(re|res|ref):\s*/i, "");
  const messageId = newMessageId(seq.id, 0, mailer.address.split("@")[1] ?? "local", Math.random().toString(36).slice(2));
  const to = msg.fromAddr || seq.email;
  const text = bookingReply(sdrOwnerName(), cfg.bookingUrl);
  await mailer.send({
    to,
    subject: `Re: ${subjectBase}`,
    text,
    messageId,
    inReplyTo: msg.messageId,
    references: [...new Set([seq.firstMessageId, seq.lastMessageId, msg.messageId].filter(Boolean))],
  });
  await prisma.$transaction([
    prisma.emailMessage.create({
      data: { sequenceId: seq.id, direction: "OUT", messageId, subject: `Re: ${subjectBase}`, fromAddr: mailer.address, body: text, at: now },
    }),
    prisma.emailMessage.update({ where: { id: msg.id }, data: { handledAt: now, handledById: userId } }),
    prisma.emailSequence.update({ where: { id: seq.id }, data: { lastMessageId: messageId } }),
  ]);
  await appendNote(prisma, seq.businessId, `Link da agenda enviado por e-mail em ${now.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}.`);
  return null;
}
