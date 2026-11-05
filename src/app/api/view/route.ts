// Beacon de visita à demo (POST de src/app/s/[slug]/DemoBeacon.tsx).
// Não conta: robôs (User-Agent), a equipe logada e revisitas em menos de 30 min.
// Sempre responde 204 — o visitante nunca vê erro por causa do rastreio.

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { resolveBusiness } from "@/lib/sites";
import { isBotUserAgent, VIEW_DEDUP_MS } from "@/lib/tracking";

const done = () => new Response(null, { status: 204 });

export async function POST(req: Request) {
  try {
    if (isBotUserAgent(req.headers.get("user-agent"))) return done();
    const session = await auth();
    if (session?.user) return done(); // equipe conferindo a demo

    const data = (await req.json().catch(() => null)) as { slug?: unknown; channel?: unknown } | null;
    const slug = typeof data?.slug === "string" ? data.slug.slice(0, 120) : "";
    const channel = data?.channel === "email" || data?.channel === "whatsapp" ? data.channel : "";
    if (!slug) return done();

    const found = await resolveBusiness(slug);
    if (!found) return done();
    const b = found.business;

    const now = new Date();
    if (b.demoLastViewAt && now.getTime() - b.demoLastViewAt.getTime() < VIEW_DEDUP_MS) return done();

    await prisma.$transaction([
      prisma.demoView.create({ data: { businessId: b.id, channel, at: now } }),
      prisma.business.update({
        where: { id: b.id },
        data: { demoViewCount: { increment: 1 }, demoLastViewAt: now },
      }),
    ]);
  } catch (e) {
    console.error("[view]", (e as Error).message);
  }
  return done();
}
