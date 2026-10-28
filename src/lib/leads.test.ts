import { describe, expect, it } from "vitest";
import { endOfTodayBRT, followUpInputValue, parseFollowUpDate } from "./leads";

describe("datas de retorno", () => {
  it("parse guarda meio-dia de Brasília e volta à mesma data", () => {
    const d = parseFollowUpDate("2026-11-03");
    expect(d?.toISOString()).toBe("2026-11-03T15:00:00.000Z");
    expect(followUpInputValue(d)).toBe("2026-11-03");
  });

  it("rejeita vazio e datas inválidas", () => {
    expect(parseFollowUpDate("")).toBeNull();
    expect(parseFollowUpDate("2026-02-30")).toBeNull();
    expect(parseFollowUpDate("03/11/2026")).toBeNull();
    expect(followUpInputValue(null)).toBe("");
  });

  it("fim de hoje respeita o fuso: 23h BRT ainda é o mesmo dia", () => {
    // 2026-11-03 23:30 BRT = 2026-11-04 02:30 UTC
    const end = endOfTodayBRT(new Date("2026-11-04T02:30:00Z"));
    expect(end.toISOString()).toBe("2026-11-04T02:59:59.999Z");
    expect(parseFollowUpDate("2026-11-03")! <= end).toBe(true);
    expect(parseFollowUpDate("2026-11-04")! <= end).toBe(false);
  });
});
