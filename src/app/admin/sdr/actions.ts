"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { normalizeEmail, selectEmailBatch } from "@/lib/emails";
import { demoSlug } from "@/lib/slug";
import { demoLink } from "@/lib/tracking";
import { mailerFromEnv, sdrOwnerName } from "@/lib/sdr/mailer";
import { newMessageId } from "@/lib/sdr/replies";
import { enrollLeads, getSdrConfig, runSdr } from "@/lib/sdr/run";
import { sequenceEmail } from "@/lib/sdr/templates";

const back = (msg: string) => redirect(`/admin/sdr?msg=${encodeURIComponent(msg)}`);

/** Liga/desliga. A 1ª vez que liga marca o início do aquecimento. */
export async function toggleSdrAction() {
  await requireAdmin();
  const cfg = await getSdrConfig(prisma);
  const enabled = !cfg.enabled;
  await prisma.sdrConfig.update({
    where: { id: 1 },
    data: {
      enabled,
      ...(enabled ? { pausedReason: "", nextSendNotBefore: null, rampStartedAt: cfg.rampStartedAt ?? new Date() } : {}),
    },
  });
  revalidatePath("/admin/sdr");
  back(enabled ? "Assistente ligado." : "Assistente desligado — nada mais é enviado (respostas continuam sendo lidas).");
}

export async function saveSdrConfigAction(form: FormData) {
  await requireAdmin();
  const bookingUrl = String(form.get("bookingUrl") ?? "").trim();
  if (bookingUrl && !/^https:\/\/\S+$/i.test(bookingUrl)) back("O link da agenda precisa começar com https://");
  const cap = Math.min(100, Math.max(1, Number(form.get("dailyCapMax")) || 40));
  await prisma.sdrConfig.upsert({
    where: { id: 1 },
    update: { bookingUrl, dailyCapMax: cap },
    create: { id: 1, bookingUrl, dailyCapMax: cap },
  });
  revalidatePath("/admin/sdr");
  back("Configuração salva.");
}

/** Coloca o próximo lote de leads (mesmos critérios do lote CSV) na sequência. */
export async function enrollBatchAction(form: FormData) {
  const session = await requireAdmin();
  const get = (k: string) => String(form.get(k) ?? "").trim();
  const batch = await selectEmailBatch(prisma, {
    filters: {
      bairro: get("bairro") || undefined,
      group: get("group") || undefined,
      presence: get("presence") || undefined,
      minScore: Number(get("minScore")) || undefined,
    },
    limit: Math.min(200, Math.max(1, Number(get("limit")) || 20)),
    ownDomainOnly: get("ownDomainOnly") === "on",
  });
  const n = await enrollLeads(prisma, batch.map(({ b, email }) => ({ businessId: b.id, email })), session.user.userId);
  revalidatePath("/admin/sdr");
  back(n ? `${n} lead(s) entraram na sequência.` : "Nenhum lead novo com esses filtros.");
}

/** Manda o 1º e-mail de um lead real para VOCÊ (não registra, não conta no limite). */
export async function sendTestAction(form: FormData) {
  await requireAdmin();
  const to = normalizeEmail(String(form.get("to") ?? ""));
  if (!to) back("Informe um e-mail válido para o teste.");
  const mailer = mailerFromEnv();
  const [lead] = await selectEmailBatch(prisma, { filters: {}, limit: 1 });
  const b = lead?.b;
  const mail = sequenceEmail(1, {
    name: b ? b.displayName || b.razaoSocial : "Padaria Exemplo",
    presenceClass: b?.presenceClass ?? "NO_SITE",
    websiteUrl: b?.websiteUrl ?? "",
    demoUrl: b ? demoLink(b.demoSite?.slug ?? demoSlug(b), "e") : demoLink("exemplo-000000", "e"),
    ownerName: sdrOwnerName(),
  });
  try {
    await mailer.send({
      to,
      subject: `[TESTE] ${mail.subject}`,
      text: mail.text,
      messageId: newMessageId("teste", 1, mailer.address.split("@")[1] ?? "local", Math.random().toString(36).slice(2)),
    });
  } catch (e) {
    back(`Falha no envio de teste: ${(e as Error).message}`);
  }
  back(
    mailer.configured
      ? `Teste enviado para ${to} (modelo com o lead "${b?.displayName ?? "exemplo"}").`
      : "Caixa não configurada (SDR_EMAIL / SDR_APP_PASSWORD): o teste só apareceu no log do servidor."
  );
}

/** Roda um ciclo agora (o mesmo do agendador). */
export async function runNowAction() {
  await requireAdmin();
  const r = await runSdr(prisma, mailerFromEnv());
  revalidatePath("/admin/sdr");
  const parts = [
    `Caixa: ${r.inbox.read} lido(s), ${r.inbox.matched} resposta(s) da sequência`,
    r.sent ? `enviado o e-mail ${r.sent.step} para ${r.sent.to}` : `envio: ${r.skipped || "—"}`,
    r.error ? `ERRO: ${r.error}` : "",
  ];
  back(parts.filter(Boolean).join(" · "));
}
