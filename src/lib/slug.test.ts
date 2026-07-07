import { describe, expect, it } from "vitest";
import { demoSlug, slugify, slugSuffix } from "./slug";

describe("slugify", () => {
  it("remove acentos e pontuação", () => {
    expect(slugify("Padaria Estrela da Gávea")).toBe("padaria-estrela-da-gavea");
    expect(slugify("Ótica & Cia. LTDA!")).toBe("otica-cia-ltda");
  });

  it("nome vazio vira placeholder", () => {
    expect(slugify("")).toBe("estabelecimento");
    expect(slugify("   ")).toBe("estabelecimento");
  });

  it("limita o tamanho sem terminar em hífen", () => {
    const long = slugify("a".repeat(30) + " " + "b".repeat(40));
    expect(long.length).toBeLessThanOrEqual(60);
    expect(long.endsWith("-")).toBe(false);
  });
});

describe("demoSlug / slugSuffix", () => {
  const b = { displayName: "Padaria Estrela da Gávea", cnpj: "11111111000191" };

  it("gera slug com sufixo dos 6 últimos dígitos do cnpj", () => {
    expect(demoSlug(b)).toBe("padaria-estrela-da-gavea-000191");
  });

  it("filiais da mesma empresa têm slugs diferentes", () => {
    const filial = { ...b, cnpj: "11111111000272" };
    expect(demoSlug(filial)).not.toBe(demoSlug(b));
  });

  it("slugSuffix extrai o sufixo de volta", () => {
    expect(slugSuffix(demoSlug(b))).toBe("000191");
    expect(slugSuffix("sem-sufixo")).toBeNull();
  });
});
