// Export CSV (admin): todos os campos, para venda manual de listas (fase 0).
// UTF-8 com BOM e separador ";" — abre direto no Excel brasileiro.

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { buildLeadWhere, normalizeMobile, PRESENCE_LABEL } from "@/lib/leads";
import { groupLabel } from "@/lib/cnae";
import { csvResponse, toCsv } from "@/lib/csv";
import { normalizeEmail } from "@/lib/emails";

const MAX_ROWS = 20_000;

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return new Response("Não autenticado", { status: 401 });
  if (session.user.role !== "ADMIN") return new Response("Só admin", { status: 403 });

  const url = new URL(req.url);
  const where = buildLeadWhere({
    bairro: url.searchParams.get("bairro") ?? undefined,
    group: url.searchParams.get("group") ?? undefined,
    presence: url.searchParams.get("presence") ?? undefined,
    minScore: Number(url.searchParams.get("minScore")) || undefined,
  });

  const [rows, suppressed] = await Promise.all([
    prisma.business.findMany({
      where, // buildLeadWhere já exclui quem pediu para sair (optOutAt)
      include: { cnae: true },
      orderBy: { score: "desc" },
      take: MAX_ROWS,
    }),
    prisma.suppressedEmail.findMany({ select: { email: true } }),
  ]);
  // e-mail na supressão sai da planilha (mesmo que o CNPJ não tenha pedido)
  const blocked = new Set(suppressed.map((s) => s.email));

  const header = [
    "nome", "razao_social", "cnpj", "segmento", "categoria", "bairro", "endereco", "cep",
    "telefone1", "telefone2", "email", "presenca_web", "score", "site", "rede_social",
    "inicio_atividade", "dados_de", "celular_whatsapp",
  ];
  const data = rows.map((b) => [
    b.displayName, b.razaoSocial, b.cnpj, groupLabel(b.cnae.group), b.cnae.label, b.bairro,
    b.street, b.cep, b.phone1, b.phone2, blocked.has(normalizeEmail(b.email)) ? "" : b.email,
    PRESENCE_LABEL[b.presenceClass] ?? b.presenceClass, b.score, b.websiteUrl, b.socialUrl,
    b.openedAt ? b.openedAt.toISOString().slice(0, 10) : "", b.ingestRef,
    normalizeMobile(b.phone1) ?? normalizeMobile(b.phone2) ?? "",
  ]);
  const stamp = new Date().toISOString().slice(0, 10);
  return csvResponse(toCsv(header, data), `sites-rio-leads-${stamp}.csv`);
}
