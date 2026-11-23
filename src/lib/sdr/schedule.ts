// Quando o assistente pode enviar e quanto. Funções puras (schedule.test.ts).
// Brasil sem horário de verão desde 2019 → Brasília = UTC-3 fixo.

const BRT_OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Dias entre os e-mails: D0 → +3 dias → +4 dias (D7). */
export const STEP_DELAY_DAYS = [3, 4];
export const MAX_STEPS = STEP_DELAY_DAYS.length + 1;

/** Envio só em dia útil, das 8h às 18h de Brasília (feriados não são tratados). */
export function inSendingWindow(now: Date): boolean {
  const brt = new Date(now.getTime() - BRT_OFFSET_MS);
  const day = brt.getUTCDay(); // 0 = domingo
  const hour = brt.getUTCHours();
  return day >= 1 && day <= 5 && hour >= 8 && hour < 18;
}

/** 00:00 de hoje em Brasília (como instante UTC). */
export function startOfDayBRT(now: Date): Date {
  const brt = new Date(now.getTime() - BRT_OFFSET_MS);
  brt.setUTCHours(0, 0, 0, 0);
  return new Date(brt.getTime() + BRT_OFFSET_MS);
}

/**
 * Limite do dia no aquecimento do domínio: semana 1 = 10, semana 2 = 20,
 * semana 3 = 30, depois o máximo configurado. Domínio novo mandando volume
 * de cara vai direto para o spam.
 */
export function dailyCap(rampStartedAt: Date | null, now: Date, max: number): number {
  if (!rampStartedAt) return Math.min(10, max);
  const week = Math.floor(Math.max(0, now.getTime() - rampStartedAt.getTime()) / (7 * DAY_MS));
  return Math.min(max, [10, 20, 30][week] ?? max);
}

/** Intervalo aleatório entre dois envios: 4 a 9 minutos (parece gente, não disparo). */
export function sendGapMs(rand: number): number {
  return Math.round((4 + 5 * Math.min(1, Math.max(0, rand))) * 60 * 1000);
}

/** Próximo envio da sequência depois do e-mail `stepJustSent` (1-based); null = acabou. */
export function nextStepAt(stepJustSent: number, now: Date): Date | null {
  const days = STEP_DELAY_DAYS[stepJustSent - 1];
  return days === undefined ? null : new Date(now.getTime() + days * DAY_MS);
}
