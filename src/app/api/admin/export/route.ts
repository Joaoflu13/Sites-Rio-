// Export CSV (admin): todos os campos, para venda manual de listas (fase 0).
// UTF-8 com BOM e separador ";" — abre direto no Excel brasileiro.

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { buildLeadWhere, PRESENCE_LABEL } from "@/lib/leads";
import { groupLabel } from "@/lib/cnae";

const MAX_ROWS = 20_000;

function csvCell(v: unknown): string {
  let s = String(v ?? "");
  // Anti fórmula-injection (CWE-1236): célula começando com =+-@ ou tab/CR
  // seria avaliada pelo Excel; o apóstrofo força texto puro.
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return `"${s.replace(/"/g, '""')}"`;
}

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

  const rows = await prisma.business.findMany({
    where,
    include: { cnae: true },
    orderBy: { score: "desc" },
    take: MAX_ROWS,
  });

  const header = [
    "nome", "razao_social", "cnpj", "segmento", "categoria", "bairro", "endereco", "cep",
    "telefone1", "telefone2", "email", "presenca_web", "score", "site", "rede_social",
    "inicio_atividade", "dados_de",
  ];
  const lines = [header.join(";")];
  for (const b of rows) {
    lines.push(
      [
        b.displayName, b.razaoSocial, b.cnpj, groupLabel(b.cnae.group), b.cnae.label, b.bairro,
        b.street, b.cep, b.phone1, b.phone2, b.email,
        PRESENCE_LABEL[b.presenceClass] ?? b.presenceClass, b.score, b.websiteUrl, b.socialUrl,
        b.openedAt ? b.openedAt.toISOString().slice(0, 10) : "", b.ingestRef,
      ]
        .map(csvCell)
        .join(";")
    );
  }

  const BOM = String.fromCharCode(0xfeff);
  const csv = BOM + lines.join("\r\n") + "\r\n";
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="sites-rio-leads-${stamp}.csv"`,
    },
  });
}
