import { describe, expect, it } from "vitest";
import { photoUrl, siteVariant, themeFor } from "./themes";
import { publicCnaeLabel } from "./cnae";

describe("siteVariant", () => {
  it("é estável por CNPJ e fica dentro da faixa", () => {
    const a = siteVariant("11111111000101", 4);
    expect(siteVariant("11111111000101", 4)).toEqual(a);
    expect(a.photo).toBeGreaterThanOrEqual(0);
    expect(a.photo).toBeLessThan(4);
    expect(["cover", "split"]).toContain(a.layout);
  });

  it("espalha os dois layouts entre CNPJs diferentes", () => {
    const layouts = new Set(
      Array.from({ length: 40 }, (_, i) => siteVariant(String(10000000000000 + i * 7919), 4).layout)
    );
    expect(layouts.size).toBe(2);
  });
});

describe("tema", () => {
  it("todo segmento tem fotos e o fallback é SERVICES", () => {
    for (const g of ["FOOD", "BEAUTY", "HEALTH", "FITNESS", "PET", "RETAIL", "SERVICES"]) {
      expect(themeFor(g).photos.length).toBeGreaterThan(0);
    }
    expect(themeFor("???")).toBe(themeFor("SERVICES"));
    expect(photoUrl("123-abc", 800)).toBe(
      "https://images.unsplash.com/photo-123-abc?auto=format&fit=crop&w=800&q=70"
    );
  });

  it("texto 'sobre' usa a preposição do bairro", () => {
    const t = themeFor("FOOD").about({ name: "Padaria X", em: "na Gávea", de: "da Gávea", bairro: "Gávea" });
    expect(t).toContain("dia a dia da Gávea");
  });
});

describe("publicCnaeLabel", () => {
  it("usa o nome amigável e, fora da lista, tira parênteses do rótulo RFB", () => {
    expect(publicCnaeLabel("5611205", "Bares (com entretenimento)")).toBe("Bar");
    expect(publicCnaeLabel("0000000", "Lojas (varejo) de discos")).toBe("Lojas de discos");
  });
});
