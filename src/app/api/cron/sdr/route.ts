// Execução periódica do assistente de vendas. Chamada por um agendador externo
// (cron-job.org, a cada 5 min) com o cabeçalho Authorization: Bearer $CRON_SECRET —
// mesmo esquema do lembrete do playa-quadra (a Vercel Hobby só roda cron 1x/dia).

import { prisma } from "@/lib/db";
import { mailerFromEnv } from "@/lib/sdr/mailer";
import { runSdr } from "@/lib/sdr/run";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: "CRON_SECRET não configurado" }, { status: 500 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "não autorizado" }, { status: 401 });
  }
  const result = await runSdr(prisma, mailerFromEnv());
  return Response.json(result, { status: result.error ? 500 : 200 });
}
