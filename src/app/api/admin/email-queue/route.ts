// Lote de e-mails de prospecção (CSV para a ferramenta de envio — NÃO enviamos
// pelo Resend: a política dele proíbe e-mail não solicitado e a conta é a dos
// e-mails transacionais do sistema).
//
// Entra no lote: lead ainda sem registro no CRM, sem opt-out, com e-mail válido
// que não é de provável contador nem está na supressão; um lead por e-mail.
// Opcional: já marca os leads como CONTATADO com retorno em 3 dias.

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { csvResponse, toCsv } from "@/lib/csv";
import { blockedEmailSet, isFreeMail, normalizeEmail, SELLABLE_PRESENCE } from "@/lib/emails";
import { buildLeadWhere, followUpInputValue, parseFollowUpDate, PRESENCE_LABEL } from "@/lib/leads";
import { buildEmail } from "@/lib/pitch";
import { demoSlug } from "@/lib/slug";
import { demoLink } from "@/lib/tracking";
import { bairroPublic } from "@/lib/bairros";
import { publicCnaeLabel } from "@/lib/cnae";
import type { PresenceClass, Prisma } from "@prisma/client";

const MAX_BATCH = 500;
const PAGE = 1000;
const MAX_SCAN = 30_000;

type Candidate = Prisma.BusinessGetPayload<{ include: { cnae: true; demoSite: true } }>;
const FOLLOW_UP_DAYS = 3;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return new Response("Não autenticado", { status: 401 });
  if (session.user.role !== "ADMIN") return new Response("Só admin", { status: 403 });

  const form = await req.formData();
  const get = (k: string) => String(form.get(k) ?? "").trim();
  const limit = Math.min(MAX_BATCH, Math.max(1, Number(get("limit")) || 50));
  const ownDomainOnly = get("ownDomainOnly") === "on";
  const mark = get("mark") === "on";
  const signature = get("signature") || process.env.SALES_SIGNATURE || "Equipe Sites Rio";

  const where = buildLeadWhere({
    bairro: get("bairro") || undefined,
    group: get("group") || undefined,
    presence: get("presence") || undefined,
    minScore: Number(get("minScore")) || undefined,
  });
  // sem filtro de presença: só as classes vendáveis (quem já tem site fica de fora)
  if (!where.presenceClass) where.presenceClass = { in: [...SELLABLE_PRESENCE] as PresenceClass[] };
  where.email = { not: "" };
  where.prospection = null;

  const blocked = await blockedEmailSet(prisma);
  const seen = new Set<string>();
  const batch: { b: Candidate; email: string }[] = [];
  // pagina pela fila (score desc) até completar o lote: contadores e
  // duplicados são pulados, então não dá para saber de antemão quantos ler
  for (let skip = 0; batch.length < limit && skip < MAX_SCAN; skip += PAGE) {
    const page: Candidate[] = await prisma.business.findMany({
      where,
      include: { cnae: true, demoSite: true },
      orderBy: [{ score: "desc" }, { id: "asc" }],
      skip,
      take: PAGE,
    });
    for (const b of page) {
      const email = normalizeEmail(b.email);
      if (!email || blocked.has(email) || seen.has(email)) continue;
      if (ownDomainOnly && isFreeMail(email)) continue;
      seen.add(email);
      batch.push({ b, email });
      if (batch.length >= limit) break;
    }
    if (page.length < PAGE) break;
  }

  const rows = batch.map(({ b, email }) => {
    const name = b.displayName || b.razaoSocial;
    const link = demoLink(b.demoSite?.slug ?? demoSlug(b), "e");
    const m = buildEmail({
      name,
      presenceClass: b.presenceClass,
      websiteUrl: b.websiteUrl,
      demoUrl: link,
      signature,
    });
    return [
      email, m.subject, m.body, name, bairroPublic(b.bairro), publicCnaeLabel(b.cnaeCode, b.cnae.label),
      link, b.cnpj, b.score, PRESENCE_LABEL[b.presenceClass] ?? b.presenceClass,
    ];
  });

  if (mark && batch.length) {
    const now = new Date();
    const today = now.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
    const followUp = parseFollowUpDate(
      followUpInputValue(new Date(now.getTime() + FOLLOW_UP_DAYS * 24 * 60 * 60 * 1000))
    );
    await prisma.prospection.createMany({
      data: batch.map(({ b }) => ({
        businessId: b.id,
        status: "CONTATADO" as const,
        notes: `E-mail de prospecção (lote de ${today}).`,
        nextFollowUpAt: followUp,
        updatedById: session.user.userId,
      })),
      skipDuplicates: true,
    });
  }

  const header = [
    "email", "assunto", "mensagem", "nome", "bairro", "segmento", "link_demo", "cnpj", "score", "presenca_web",
  ];
  const stamp = new Date().toISOString().slice(0, 10);
  return csvResponse(toCsv(header, rows), `sites-rio-emails-${stamp}-${rows.length}.csv`);
}
