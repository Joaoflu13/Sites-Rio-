// Enriquecimento de presença web: para cada estabelecimento ainda não
// verificado, busca "<nome>" <bairro> rio de janeiro numa API de busca,
// classifica (classify.ts) e calcula o score (score.ts).
//
// Retomável e idempotente por construção: a fila é `presenceCheckedAt IS NULL`
// e cada item é carimbado no mesmo update do resultado — rodar de novo continua
// de onde parou, sem repetir busca (nem re-gastar API).
//
// Uso:
//   npm run enrich -- --max 300                       # 300 itens (provider do .env)
//   npm run enrich -- --provider google-cse --max 50
//   npm run enrich -- --bairro Copacabana --group HEALTH --max 100
//   npm run enrich -- --qps 2                         # 2 buscas/s (default 1)
//   npm run enrich -- --dry-run                       # mostra a fila, não busca

import { parseArgs, scriptPrisma } from "./lib/rfb";
import { classifyPresence } from "../src/lib/classify";
import { computeScore } from "../src/lib/score";
import { bairroTier } from "../src/lib/bairros";
import { finderFromEnv, RateLimitError } from "../src/lib/finder";

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const max = args.max ? Number(args.max) : 100;
  const qps = args.qps ? Number(args.qps) : 1;
  const dryRun = Boolean(args["dry-run"]);
  const prisma = scriptPrisma();

  // Fila: não verificados, mais vendáveis primeiro (peso do CNAE, tier, telefone).
  const queue = await prisma.business.findMany({
    where: {
      presenceCheckedAt: null,
      ...(args.bairro ? { bairro: { equals: String(args.bairro), mode: "insensitive" } } : {}),
      ...(args.group ? { cnae: { group: String(args.group).toUpperCase() } } : {}),
    },
    include: { cnae: true },
    orderBy: [{ cnae: { valueWeight: "desc" } }, { id: "asc" }],
    take: max * 3, // margem para ordenar por tier em memória
  });
  queue.sort((a, b) => {
    const byWeight = b.cnae.valueWeight - a.cnae.valueWeight;
    if (byWeight !== 0) return byWeight;
    const byTier = bairroTier(a.bairro) - bairroTier(b.bairro);
    if (byTier !== 0) return byTier;
    return (b.phone1 ? 1 : 0) - (a.phone1 ? 1 : 0);
  });
  const items = queue.slice(0, max);

  console.log(`Fila: ${items.length} estabelecimento(s) para verificar (de ${queue.length} candidatos).`);
  if (dryRun) {
    for (const b of items.slice(0, 20)) {
      console.log(`  ${b.displayName || "(sem nome)"} — ${b.bairro} — ${b.cnae.label}`);
    }
    await prisma.$disconnect();
    return;
  }
  if (items.length === 0) {
    await prisma.$disconnect();
    return;
  }

  const finder = finderFromEnv(args.provider ? String(args.provider) : undefined);
  const run = await prisma.ingestionRun.create({
    data: { kind: "ENRICHMENT", sourceRef: finder.name },
  });

  let done = 0;
  let failedStreak = 0;
  const t0 = Date.now();

  for (const b of items) {
    const name = (b.displayName ?? "").trim();

    // Sem nome utilizável: não dá para buscar — marca UNKNOWN e segue.
    if (name.length < 3) {
      await prisma.business.update({
        where: { id: b.id },
        data: {
          presenceClass: "UNKNOWN",
          presenceCheckedAt: new Date(),
          presenceEvidence: { provider: finder.name, query: "", results: [], reason: "NO_NAME" },
          score: computeScore({
            presenceClass: "UNKNOWN",
            valueWeight: b.cnae.valueWeight,
            hasPhone: Boolean(b.phone1 || b.phone2),
            hasEmail: Boolean(b.email),
            bairroTier: bairroTier(b.bairro),
          }),
        },
      });
      done++;
      continue;
    }

    const query = `"${name}" ${b.bairro} rio de janeiro`;
    try {
      const results = await finder.search(query);
      const c = classifyPresence(name, results, { provider: finder.name, query });
      await prisma.business.update({
        where: { id: b.id },
        data: {
          presenceClass: c.presenceClass,
          websiteUrl: c.websiteUrl,
          socialUrl: c.socialUrl,
          presenceEvidence: c.evidence,
          presenceCheckedAt: new Date(),
          score: computeScore({
            presenceClass: c.presenceClass,
            valueWeight: b.cnae.valueWeight,
            hasPhone: Boolean(b.phone1 || b.phone2),
            hasEmail: Boolean(b.email),
            bairroTier: bairroTier(b.bairro),
          }),
        },
      });
      done++;
      failedStreak = 0;
      if (done % 25 === 0) {
        console.log(`  ${done}/${items.length} verificados…`);
        await prisma.ingestionRun.update({
          where: { id: run.id },
          data: { processedLines: BigInt(done), affectedRows: done },
        });
      }
    } catch (e) {
      if (e instanceof RateLimitError) {
        failedStreak++;
        const wait = Math.min(60_000, 2 ** failedStreak * 1000);
        console.warn(`Rate limit do provider — aguardando ${wait / 1000}s…`);
        await sleep(wait);
        if (failedStreak >= 6) {
          console.error("Cota do provider esgotada — parando (rode de novo mais tarde, a fila continua).");
          break;
        }
      } else {
        console.error(`Erro em "${name}":`, (e as Error).message);
        failedStreak++;
        if (failedStreak >= 6) {
          console.error("Erros demais em sequência — parando.");
          break;
        }
      }
      continue; // item NÃO carimbado: volta pra fila na próxima execução
    }

    await sleep(1000 / qps); // rate limit fixo
  }

  await prisma.ingestionRun.update({
    where: { id: run.id },
    data: {
      status: "DONE",
      finishedAt: new Date(),
      processedLines: BigInt(done),
      affectedRows: done,
    },
  });
  console.log(`Fim: ${done} verificados em ${((Date.now() - t0) / 1000).toFixed(0)}s.`);
  await prisma.$disconnect();
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
