// Recalcula o score de TODOS os estabelecimentos (sem novas buscas).
// Use quando a fórmula (score.ts), os pesos de CNAE ou os tiers de bairro mudarem.
// Também rebaixa para WEAK_SITE quem foi marcado HAS_SITE com site em construtor
// grátis (negocio.site, wixsite…) antes dessa classe existir — sem nova busca.
// Uso: npm run rescore

import { scriptPrisma } from "./lib/rfb";
import { computeScore } from "../src/lib/score";
import { bairroTier } from "../src/lib/bairros";
import { isFreeBuilder } from "../src/lib/classify";

const PAGE = 2000;

async function main() {
  const prisma = scriptPrisma();
  let cursor: string | undefined;
  let updated = 0;
  let weak = 0;

  for (;;) {
    const page = await prisma.business.findMany({
      include: { cnae: true },
      orderBy: { id: "asc" },
      take: PAGE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
    if (page.length === 0) break;

    for (const b of page) {
      const presenceClass =
        b.presenceClass === "HAS_SITE" && isFreeBuilder(b.websiteUrl) ? "WEAK_SITE" : b.presenceClass;
      const score = computeScore({
        presenceClass,
        valueWeight: b.cnae.valueWeight,
        hasPhone: Boolean(b.phone1 || b.phone2),
        hasEmail: Boolean(b.email),
        bairroTier: bairroTier(b.bairro),
      });
      if (score !== b.score || presenceClass !== b.presenceClass) {
        await prisma.business.update({ where: { id: b.id }, data: { score, presenceClass } });
        updated++;
        if (presenceClass !== b.presenceClass) weak++;
      }
    }
    cursor = page[page.length - 1].id;
    console.log(`  …até ${cursor} (${updated} atualizados)`);
  }

  console.log(`Fim: ${updated} scores atualizados (${weak} reclassificados como site grátis).`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
