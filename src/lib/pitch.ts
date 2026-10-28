// Mensagem de abordagem por WhatsApp, adaptada ao que a busca encontrou.
// Função pura (testada em pitch.test.ts): o argumento muda conforme a presença
// web — quem já tem Instagram não ouve "vocês não aparecem em lugar nenhum".

import type { PresenceClass } from "@prisma/client";
import { isFreeBuilder, domainOf } from "@/lib/classify";
import { OFFER } from "@/lib/themes";

export type PitchInput = {
  name: string;
  presenceClass: PresenceClass;
  websiteUrl: string;
  demoUrl: string;
};

/** Domínios do antigo site do Google Meu Negócio (desligado em 2024). */
function isGoogleBusinessSite(url: string): boolean {
  const d = domainOf(url);
  return d.endsWith("negocio.site") || d.endsWith("business.site");
}

function hook(i: PitchInput): string {
  const n = i.name;
  switch (i.presenceClass) {
    case "SOCIAL_ONLY":
      return (
        `vi o trabalho de ${n} no Instagram — muito bom! Mas quem pesquisa no Google ` +
        `não acha um site de vocês, e muita gente não fecha só pela rede social.`
      );
    case "AGGREGATOR_ONLY":
      return (
        `vi ${n} nos aplicativos, mas não achei um site próprio — ` +
        `todo cliente que chega por lá paga comissão para o app.`
      );
    case "WEAK_SITE":
      if (isGoogleBusinessSite(i.websiteUrl)) {
        return (
          `o site de ${n} no Google (${domainOf(i.websiteUrl)}) saiu do ar — o Google ` +
          `desligou esse tipo de site, e quem clica cai numa página de erro.`
        );
      }
      return (
        `vi que o site de ${n} está num endereço gratuito` +
        (isFreeBuilder(i.websiteUrl) ? ` (${domainOf(i.websiteUrl)})` : "") +
        ` — passa menos confiança e aparece pouco no Google.`
      );
    default:
      return (
        `fiz uma pesquisa no Google e vi que ${n} ainda não tem site próprio — ` +
        `quem procura acaba caindo no concorrente ou pagando comissão de aplicativo.`
      );
  }
}

export function buildPitch(i: PitchInput): string {
  return (
    `Olá! ${capitalize(hook(i))} ` +
    `Eu já deixei um site pronto para vocês, dá uma olhada: ${i.demoUrl} — ` +
    `se gostar, coloco no ar com endereço próprio por ${OFFER.setup} + ${OFFER.monthly}.`
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
