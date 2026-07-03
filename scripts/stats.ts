// Estatísticas do banco: contagens por classe/grupo/bairro, runs recentes e
// tamanho físico do banco (guardrail do Supabase free de 500MB).
// Uso: npm run stats

import { scriptPrisma } from "./lib/rfb";
import { groupLabel } from "../src/lib/cnae";

const WARN_ROWS = 250_000; // acima disso, desabilite CNAEs de menor peso e reimporte

async function main() {
  const prisma = scriptPrisma();

  const total = await prisma.business.count();
  console.log(`Estabelecimentos: ${total.toLocaleString("pt-BR")}`);
  if (total > WARN_ROWS) {
    console.warn(
      `⚠ Acima de ${WARN_ROWS.toLocaleString("pt-BR")} linhas — considere CnaeCategory.enabled=false nas categorias de menor valueWeight.`
    );
  }

  const byClass = await prisma.business.groupBy({ by: ["presenceClass"], _count: true });
  console.log("\nPor classe de presença:");
  for (const r of byClass) console.log(`  ${r.presenceClass}: ${r._count.toLocaleString("pt-BR")}`);

  const cats = await prisma.cnaeCategory.findMany();
  const byCnae = await prisma.business.groupBy({ by: ["cnaeCode"], _count: true });
  const byGroup = new Map<string, number>();
  for (const r of byCnae) {
    const g = cats.find((c) => c.code === r.cnaeCode)?.group ?? "?";
    byGroup.set(g, (byGroup.get(g) ?? 0) + r._count);
  }
  console.log("\nPor grupo:");
  for (const [g, n] of [...byGroup.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${groupLabel(g)}: ${n.toLocaleString("pt-BR")}`);
  }

  const byBairro = await prisma.business.groupBy({
    by: ["bairro"],
    _count: true,
    orderBy: { _count: { bairro: "desc" } },
    take: 15,
  });
  console.log("\nTop 15 bairros:");
  for (const r of byBairro) console.log(`  ${r.bairro}: ${r._count.toLocaleString("pt-BR")}`);

  const runs = await prisma.ingestionRun.findMany({ orderBy: { startedAt: "desc" }, take: 5 });
  console.log("\nRuns recentes:");
  for (const r of runs) {
    console.log(
      `  ${r.startedAt.toISOString().slice(0, 16)} ${r.kind} ${r.sourceRef} ${r.status} linhas=${r.processedLines} afetadas=${r.affectedRows}${r.error ? ` erro=${r.error}` : ""}`
    );
  }

  const size = await prisma.$queryRaw<{ size: string }[]>`
    SELECT pg_size_pretty(pg_database_size(current_database())) AS size`;
  console.log(`\nTamanho do banco: ${size[0]?.size} (limite Supabase free: 500MB)`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
