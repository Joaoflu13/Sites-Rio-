// Score de oportunidade (0–100) de um lead. Função pura (testada em score.test.ts).
// Quanto maior, mais vale a pena o dev gastar um crédito.

import type { PresenceClass } from "@prisma/client";

const PRESENCE_BASE: Record<PresenceClass, number> = {
  NO_SITE: 45,          // nada na web: lead perfeito
  SOCIAL_ONLY: 35,      // já investe em presença, falta o site
  AGGREGATOR_ONLY: 30,  // paga comissão a terceiros
  UNKNOWN: 15,          // ainda não verificado
  HAS_SITE: 0,
};

const TIER_BONUS: Record<1 | 2 | 3, number> = { 1: 15, 2: 8, 3: 0 };

export type ScoreInput = {
  presenceClass: PresenceClass;
  valueWeight: number; // 0–25 (CnaeCategory)
  hasPhone: boolean;
  hasEmail: boolean;
  bairroTier: 1 | 2 | 3;
};

export function computeScore(i: ScoreInput): number {
  const raw =
    PRESENCE_BASE[i.presenceClass] +
    Math.max(0, Math.min(25, i.valueWeight)) +
    (i.hasPhone ? 10 : 0) +
    (i.hasEmail ? 5 : 0) +
    TIER_BONUS[i.bairroTier];
  return Math.max(0, Math.min(100, raw));
}
