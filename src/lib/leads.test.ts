import { describe, expect, it } from "vitest";
import {
  endOfTodayBRT,
  followUpInputValue,
  normalizeMobile,
  parseFollowUpDate,
  phoneKind,
  whatsappUrl,
} from "./leads";

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

describe("celular x fixo", () => {
  it("celular de 11 dígitos vira link; fixo não", () => {
    expect(whatsappUrl("21999998888")).toBe("https://wa.me/5521999998888");
    expect(whatsappUrl("2125551234")).toBeNull();
    expect(whatsappUrl("")).toBeNull();
  });

  it("celular antigo sem o 9º dígito ganha o 9", () => {
    expect(normalizeMobile("2198887777")).toBe("21998887777");
    expect(normalizeMobile("2178887777")).toBe("21978887777");
  });

  it("pula o fixo e usa o celular do segundo telefone", () => {
    expect(whatsappUrl("2125551234", "21988887777")).toBe("https://wa.me/5521988887777");
  });

  it("aceita +55 e máscara; rótulo Celular/Fixo", () => {
    expect(normalizeMobile("+55 (21) 99999-8888")).toBe("21999998888");
    expect(phoneKind("2125551234")).toBe("Fixo");
    expect(phoneKind("21999998888")).toBe("Celular");
  });
});
