"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { demoSlug, slugify } from "@/lib/slug";

/** Ativa o site de um cliente (cria a linha DemoSite a partir do CNPJ). */
export async function createDemoSite(form: FormData) {
  await requireAdmin();
  const cnpj = String(form.get("cnpj") ?? "").replace(/\D/g, "");
  if (cnpj.length !== 14) redirect("/admin/sites?error=cnpj");

  const business = await prisma.business.findUnique({ where: { cnpj }, include: { demoSite: true } });
  if (!business) redirect("/admin/sites?error=naoencontrado");
  if (business.demoSite) redirect(`/admin/sites?edit=${business.demoSite.id}`);

  const site = await prisma.demoSite.create({
    data: { businessId: business.id, slug: demoSlug(business) },
  });
  revalidatePath("/admin/sites");
  redirect(`/admin/sites?edit=${site.id}&ok=criado`);
}

/** Salva conteúdo/publicação de um site. */
export async function saveDemoSite(form: FormData) {
  await requireAdmin();
  const id = String(form.get("id") ?? "");
  if (!id) redirect("/admin/sites");

  // Na venda o slug pode ser encurtado (ex.: "padaria-estrela"); sanitiza sempre.
  const slug = slugify(String(form.get("slug") ?? ""));

  try {
    await prisma.demoSite.update({
      where: { id },
      data: {
        slug,
        published: form.get("published") === "on",
        headline: String(form.get("headline") ?? "").trim(),
        about: String(form.get("about") ?? "").trim(),
        hours: String(form.get("hours") ?? "").trim(),
        instagram: String(form.get("instagram") ?? "").trim(),
        whatsapp: String(form.get("whatsapp") ?? "").replace(/\D/g, ""),
        customDomain: String(form.get("customDomain") ?? "").trim().toLowerCase(),
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      redirect(`/admin/sites?edit=${id}&error=slug`);
    }
    throw e;
  }
  revalidatePath("/admin/sites");
  redirect(`/admin/sites?edit=${id}&ok=salvo`);
}
