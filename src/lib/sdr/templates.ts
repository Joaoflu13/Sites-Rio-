// Textos da sequência do assistente. Texto puro, um único link (a demo), e o
// assistente se apresenta como assistente virtual — nunca finge ser gente.

import type { PresenceClass } from "@prisma/client";
import { buildEmail } from "@/lib/pitch";

export type SequenceContext = {
  name: string;
  presenceClass: PresenceClass;
  websiteUrl: string;
  demoUrl: string;
  ownerName: string;
};

export function signature(ownerName: string): string {
  return `Assistente virtual do ${ownerName} · Sites Rio\n(as respostas a este e-mail são lidas pelo ${ownerName})`;
}

const FOOTER =
  "--\nEncontrei este contato no cadastro público do CNPJ. Se não quiser receber mais mensagens, " +
  "é só responder SAIR que removo na hora.";

/** E-mail `step` (1..3) da sequência. Os seguintes vão na mesma conversa ("Re:"). */
export function sequenceEmail(step: number, c: SequenceContext, firstSubject = ""): { subject: string; text: string } {
  if (step === 1) {
    const m = buildEmail({ ...c, signature: signature(c.ownerName) });
    return { subject: m.subject, text: m.body };
  }
  const subject = firstSubject ? `Re: ${firstSubject}` : `${c.name}: site pronto para vocês`;
  const lines =
    step === 2
      ? [
          "Olá! Passando só para saber se deu para olhar o site que montei para vocês:",
          c.demoUrl,
          "",
          `Se fizer sentido, dá para marcar 15 minutos com o ${c.ownerName} direto pela página.`,
        ]
      : [
          "Vou encerrar por aqui para não incomodar.",
          "",
          `Se um dia quiserem o site no ar, é só responder este e-mail que o ${c.ownerName} cuida de tudo. ` +
            `A demonstração continua disponível: ${c.demoUrl}`,
        ];
  return { subject, text: ["Olá, tudo bem?", "", ...lines, "", signature(c.ownerName), "", FOOTER].join("\n") };
}

/** Resposta "Enviar link da agenda" (aba Respostas, aprovada com 1 clique). */
export function bookingReply(ownerName: string, bookingUrl: string): string {
  return [
    "Que bom que gostou!",
    "",
    `Você pode escolher o melhor horário para conversar 15 minutos com o ${ownerName} por aqui: ${bookingUrl}`,
    "",
    "Se preferir, responda com um dia e horário que ele te chama.",
    "",
    signature(ownerName),
  ].join("\n");
}
