import { describe, expect, it } from "vitest";
import { computeScore } from "./score";

describe("computeScore", () => {
  it("lead perfeito: sem site, saúde, contato completo, Zona Sul", () => {
    expect(
      computeScore({ presenceClass: "NO_SITE", valueWeight: 25, hasPhone: true, hasEmail: true, bairroTier: 1 })
    ).toBe(100);
  });

  it("quem já tem site pontua baixo", () => {
    expect(
      computeScore({ presenceClass: "HAS_SITE", valueWeight: 25, hasPhone: true, hasEmail: true, bairroTier: 1 })
    ).toBe(55);
  });

  it("não verificado fica no meio-termo", () => {
    const s = computeScore({ presenceClass: "UNKNOWN", valueWeight: 12, hasPhone: false, hasEmail: false, bairroTier: 3 });
    expect(s).toBe(27);
  });

  it("clampa em 0..100 e ignora valueWeight fora da faixa", () => {
    expect(
      computeScore({ presenceClass: "NO_SITE", valueWeight: 999, hasPhone: true, hasEmail: true, bairroTier: 1 })
    ).toBe(100);
    expect(
      computeScore({ presenceClass: "HAS_SITE", valueWeight: -5, hasPhone: false, hasEmail: false, bairroTier: 3 })
    ).toBe(0);
  });

  it("SOCIAL_ONLY > AGGREGATOR_ONLY > HAS_SITE na base", () => {
    const base = { valueWeight: 0, hasPhone: false, hasEmail: false, bairroTier: 3 as const };
    const social = computeScore({ ...base, presenceClass: "SOCIAL_ONLY" });
    const agg = computeScore({ ...base, presenceClass: "AGGREGATOR_ONLY" });
    const site = computeScore({ ...base, presenceClass: "HAS_SITE" });
    expect(social).toBeGreaterThan(agg);
    expect(agg).toBeGreaterThan(site);
  });
});
