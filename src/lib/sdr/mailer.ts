// Caixa do assistente: envia por SMTP e lê respostas por IMAP (Google Workspace,
// com senha de app). Sem SDR_EMAIL/SDR_APP_PASSWORD, cai no modo simulação:
// nada sai, o envio só aparece no log — mesmo padrão de src/lib/mail.ts.

import nodemailer from "nodemailer";
import { ImapFlow } from "imapflow";
import { sdrFromName } from "./identity";

export { sdrFromName, sdrOwnerName } from "./identity";

export type OutgoingMail = {
  to: string;
  subject: string;
  text: string;
  messageId: string;
  inReplyTo?: string;
  references?: string[];
};

export type FetchState = { uidValidity: bigint | null; lastUid: number };
export type FetchResult = { uidValidity: bigint; lastUid: number; messages: { uid: number; raw: Buffer }[] };

export interface SdrMailer {
  /** endereço da caixa (remetente) */
  address: string;
  /** false = modo simulação (sem credenciais) */
  configured: boolean;
  send(m: OutgoingMail): Promise<void>;
  /** e-mails novos da caixa de entrada desde o último UID lido */
  fetchNew(state: FetchState): Promise<FetchResult>;
}

/** Opções do nodemailer para um e-mail do assistente (exportado para testes). */
export function mailOptions(fromName: string, address: string, m: OutgoingMail) {
  return {
    from: { name: fromName, address },
    to: m.to,
    subject: m.subject,
    text: m.text,
    messageId: m.messageId,
    inReplyTo: m.inReplyTo,
    references: m.references,
    headers: { "List-Unsubscribe": `<mailto:${address}?subject=SAIR>` },
  };
}

/** Por leitura: o resto fica para a próxima execução. */
const FETCH_LIMIT = 50;

export function mailerFromEnv(): SdrMailer {
  const user = (process.env.SDR_EMAIL ?? "").trim().toLowerCase();
  const pass = (process.env.SDR_APP_PASSWORD ?? "").replace(/\s+/g, "");
  if (!user || !pass) return simulationMailer(user || "assistente@exemplo.com.br");

  const smtp = nodemailer.createTransport({
    host: process.env.SDR_SMTP_HOST || "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user, pass },
  });
  const fromName = sdrFromName();

  return {
    address: user,
    configured: true,
    async send(m) {
      await smtp.sendMail(mailOptions(fromName, user, m));
    },
    async fetchNew(state) {
      const client = new ImapFlow({
        host: process.env.SDR_IMAP_HOST || "imap.gmail.com",
        port: 993,
        secure: true,
        auth: { user, pass },
        logger: false,
      });
      await client.connect();
      const lock = await client.getMailboxLock("INBOX");
      try {
        const box = client.mailbox;
        if (!box) throw new Error("INBOX indisponível");
        const uidValidity = BigInt(box.uidValidity);
        // 1ª leitura (ou caixa recriada): começa do fim — histórico antigo não é resposta à sequência
        if (state.uidValidity === null || state.uidValidity !== uidValidity) {
          return { uidValidity, lastUid: Math.max(0, box.uidNext - 1), messages: [] };
        }
        const messages: { uid: number; raw: Buffer }[] = [];
        if (box.uidNext - 1 > state.lastUid) {
          for await (const msg of client.fetch(`${state.lastUid + 1}:*`, { uid: true, source: true }, { uid: true })) {
            if (msg.uid > state.lastUid && msg.source) messages.push({ uid: msg.uid, raw: msg.source });
            if (messages.length >= FETCH_LIMIT) break;
          }
        }
        messages.sort((a, b) => a.uid - b.uid);
        const lastUid = messages.length ? messages[messages.length - 1].uid : state.lastUid;
        return { uidValidity, lastUid, messages };
      } finally {
        lock.release();
        await client.logout().catch(() => undefined);
      }
    },
  };
}

function simulationMailer(address: string): SdrMailer {
  return {
    address,
    configured: false,
    async send(m) {
      console.log(`[sdr:simulação] para ${m.to} — ${m.subject}\n${m.text}\n`);
    },
    async fetchNew(state) {
      return { uidValidity: state.uidValidity ?? BigInt(1), lastUid: state.lastUid, messages: [] };
    },
  };
}
