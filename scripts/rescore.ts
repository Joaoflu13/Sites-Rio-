// Recalcula o score de TODOS os estabelecimentos (sem novas buscas).
// Use quando a fórmula (score.ts), os pesos de CNAE ou os tiers de bairro mudarem.
// Uso: npm run rescore

import { scriptPrisma } from "./lib/rfb";
import { computeScore } from "../src/lib/score";
import { bairroTier } from "../src/lib/bairros";

const PAGE = 2000;

async function main() {
  const prisma = scriptPrisma();
  let cursor: string | undefined;
  let updated = 0;

  for (;;) {
    const page = await prisma.business.findMany({
      include: { cnae: true },
      orderBy: { id: "asc" },
      take: PAGE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
    if (page.length === 0) break;

    for (const b of page) {
      const score = computeScore({
        presenceClass: b.presenceClass,
        valueWeight: b.cnae.valueWeight,
        hasPhone: Boolean(b.phone1 || b.phone2),
        hasEmail: Boolean(b.email),
        bairroTier: bairroTier(b.bairro),
      });
      if (score !== b.score) {
        await prisma.business.update({ where: { id: b.id }, data: { score } });
        updated++;
      }
    }
    cursor = page[page.length - 1].id;
    console.log(`  …até ${cursor} (${updated} atualizados)`);
  }

  console.log(`Fim: ${updated} scores atualizados.`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
