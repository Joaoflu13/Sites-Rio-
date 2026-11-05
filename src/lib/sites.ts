// Resolução do site público /s/[slug] -> estabelecimento. Compartilhado pela
// página e pelo beacon de visitas (/api/view).

import { prisma } from "@/lib/db";
import { demoSlug, slugSuffix } from "@/lib/slug";

export async function resolveBusiness(slug: string) {
  // 1) slug personalizado/vendido (linha DemoSite)
  const demo = await prisma.demoSite.findUnique({
    where: { slug },
    include: { business: { include: { cnae: true } } },
  });
  if (demo) return { business: demo.business, demo };

  // 2) slug determinístico: sufixo = 6 últimos dígitos do CNPJ
  const suffix = slugSuffix(slug);
  if (!suffix) return null;
  const candidates = await prisma.business.findMany({
    where: { cnpj: { endsWith: suffix } },
    include: { cnae: true, demoSite: true },
    take: 20,
  });
  const business = candidates.find((b) => demoSlug(b) === slug);
  if (!business) return null;
  return { business, demo: business.demoSite ?? null };
}
