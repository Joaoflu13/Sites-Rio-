// Rastreio de visitas à demo. A contagem vem de um beacon JS disparado pela
// página (src/app/s/[slug]/DemoBeacon.tsx): robôs de pré-visualização de link
// (WhatsApp, Gmail, antivírus de e-mail) não executam JS, e o User-Agent
// filtra o resto. A equipe logada também não conta (ver /api/view).

/** Visitas do mesmo estabelecimento dentro desta janela contam uma vez. */
export const VIEW_DEDUP_MS = 30 * 60 * 1000;

const CHANNELS: Record<string, string> = { e: "email", w: "whatsapp" };

/** ?c=e -> "email", ?c=w -> "whatsapp", resto -> "". */
export function channelFromParam(c: string | null | undefined): string {
  return CHANNELS[c ?? ""] ?? "";
}

export const CHANNEL_LABEL: Record<string, string> = { email: "e-mail", whatsapp: "WhatsApp" };

const BOT_UA =
  /bot|crawl|spider|preview|whatsapp|facebookexternalhit|slack|telegram|discord|skype|headless|python|curl|wget|okhttp|go-http|java\/|axios|node-fetch|scanner|safelinks|proofpoint|mimecast|barracuda|lighthouse/i;

/** true para robôs, pré-visualizadores de link e clientes HTTP de script. */
export function isBotUserAgent(ua: string | null | undefined): boolean {
  if (!ua) return true;
  return BOT_UA.test(ua);
}

/** Base pública dos links de demo: DEMO_BASE_URL (domínio próprio) ou APP_URL. */
export function demoBaseUrl(): string {
  return (process.env.DEMO_BASE_URL || process.env.APP_URL || "http://localhost:3000").replace(/\/+$/, "");
}

/** Link da demo com a marca do canal (e = e-mail, w = WhatsApp). */
export function demoLink(slug: string, channel?: "e" | "w"): string {
  return `${demoBaseUrl()}/s/${slug}${channel ? `?c=${channel}` : ""}`;
}

/** "há 5 min" / "há 3 h" / "há 2 dias" (pt-BR, aproximado). */
export function timeAgo(d: Date, now: Date = new Date()): string {
  const min = Math.max(0, Math.round((now.getTime() - d.getTime()) / 60000));
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const days = Math.round(h / 24);
  return `há ${days} dia${days > 1 ? "s" : ""}`;
}
