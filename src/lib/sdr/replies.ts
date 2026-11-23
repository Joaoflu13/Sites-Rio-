// Classificação das respostas que chegam na caixa do assistente. Regras
// simples e conservadoras: na dúvida é HUMAN (vai para você na aba Respostas).

import type { ReplyKind } from "@prisma/client";

export type InboundMail = {
  from: string;
  subject: string;
  /** cabeçalhos em minúsculas */
  headers: Record<string, string>;
  text: string;
  contentType?: string;
};

/** Tira a parte citada ("> ...", "Em ... escreveu:", "On ... wrote:") e assinaturas de celular. */
export function stripQuoted(text: string): string {
  const out: string[] = [];
  for (const line of text.replace(/\r/g, "").split("\n")) {
    const l = line.trim();
    if (/^(em|on)\s.+(escreveu|wrote):?$/i.test(l)) break;
    if (/^-{2,}\s*(original message|mensagem original)/i.test(l)) break;
    if (/^(de|from):\s.+/i.test(l) && out.length > 0) break;
    if (/^enviado (do|de) meu/i.test(l) || /^sent from my/i.test(l)) break;
    if (l.startsWith(">")) continue;
    out.push(line);
  }
  return out.join("\n").trim();
}

const OPT_OUT =
  /(^\s*sair\b)|\b(descadastr|unsubscribe|remov(a|er|am)\s+(meu|o|nosso)\s+(e-?mail|contato|endere[cç]o)|n[ãa]o\s+(me\s+)?(envie|enviem|mande|mandem)|pare(m)?\s+de\s+(enviar|mandar)|n[ãa]o\s+(tenho|temos)\s+interesse|n[ãa]o\s+quero\s+receber|sem\s+interesse)\b/i;

const AUTO_SUBJECT =
  /^(resposta autom[aá]tica|automatic reply|auto(matic)?[- ]?reply|ausente|out of (the )?office|f[ée]rias|aviso de aus[eê]ncia)/i;

export function classifyReply(m: InboundMail): ReplyKind {
  const from = m.from.toLowerCase();
  const ct = (m.contentType ?? m.headers["content-type"] ?? "").toLowerCase();
  if (/^(mailer-daemon|postmaster)@/.test(from) || ct.includes("report-type=delivery-status")) return "BOUNCE";

  const auto = (m.headers["auto-submitted"] ?? "").toLowerCase();
  if (
    (auto && auto !== "no") ||
    m.headers["x-autoreply"] ||
    m.headers["x-autorespond"] ||
    /auto[_-]?reply/i.test(m.headers["precedence"] ?? "") ||
    AUTO_SUBJECT.test(m.subject.trim())
  ) {
    return "AUTO_REPLY";
  }

  if (OPT_OUT.test(stripQuoted(m.text).slice(0, 400))) return "OPT_OUT";
  return "HUMAN";
}

/** Message-IDs gerados pelo assistente que aparecem num texto bruto (casa respostas e avisos de não entrega). */
export function ourMessageIds(raw: string): string[] {
  return [...new Set(raw.match(/<sdr\.[A-Za-z0-9.]+@[A-Za-z0-9.-]+>/g) ?? [])];
}

/** Message-ID novo do assistente: <sdr.{sequência}.{passo}.{aleatório}@{domínio}>. */
export function newMessageId(sequenceId: string, step: number, domain: string, rand: string): string {
  return `<sdr.${sequenceId}.${step}.${rand.replace(/[^A-Za-z0-9]/g, "").slice(0, 12)}@${domain}>`;
}
