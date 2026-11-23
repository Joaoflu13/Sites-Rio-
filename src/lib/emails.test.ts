import { describe, expect, it } from "vitest";
import { emailDomain, isFreeMail, normalizeEmail } from "./emails";

describe("emails", () => {
  it("normaliza e rejeita lixo", () => {
    expect(normalizeEmail("  Contato@Padaria.com.BR ")).toBe("contato@padaria.com.br");
    expect(normalizeEmail("sem-arroba")).toBe("");
    expect(normalizeEmail("a@b")).toBe("");
    expect(normalizeEmail(null)).toBe("");
  });

  it("provedor gratuito x domínio próprio", () => {
    expect(isFreeMail("dono@gmail.com")).toBe(true);
    expect(isFreeMail("dono@bol.com.br")).toBe(true);
    expect(isFreeMail("contato@padariaestrela.com.br")).toBe(false);
    expect(emailDomain("x@y.com")).toBe("y.com");
  });
});
