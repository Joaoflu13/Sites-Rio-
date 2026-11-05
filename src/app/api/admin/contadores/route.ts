// CSV dos prováveis escritórios de contabilidade (e-mail repetido em vários CNPJs):
// lista para propor parceria. Admin apenas.

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { csvResponse, toCsv } from "@/lib/csv";
import { ACCOUNTANT_CSV_HEADER, accountantRows } from "@/lib/emails";

export async function GET() {
  const session = await auth();
  if (!session?.user) return new Response("Não autenticado", { status: 401 });
  if (session.user.role !== "ADMIN") return new Response("Só admin", { status: 403 });

  const rows = await accountantRows(prisma);
  const stamp = new Date().toISOString().slice(0, 10);
  return csvResponse(toCsv(ACCOUNTANT_CSV_HEADER, rows), `sites-rio-contadores-${stamp}.csv`);
}
