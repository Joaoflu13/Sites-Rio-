import { describe, expect, it } from "vitest";
import { bairroDe, bairroEm, bairroPublic } from "./bairros";

describe("preposição do bairro", () => {
  it("feminino, masculino e sem artigo", () => {
    expect(bairroEm("TIJUCA")).toBe("na Tijuca");
    expect(bairroEm("Gávea")).toBe("na Gávea");
    expect(bairroEm("LEBLON")).toBe("no Leblon");
    expect(bairroEm("COPACABANA")).toBe("em Copacabana");
    expect(bairroDe("BARRA DA TIJUCA")).toBe("da Barra da Tijuca");
    expect(bairroDe("JARDIM BOTANICO")).toBe("do Jardim Botânico");
    expect(bairroDe("IPANEMA")).toBe("de Ipanema");
  });
});

describe("bairroPublic", () => {
  it("restaura acento conhecido e cai no Title Case no resto", () => {
    expect(bairroPublic("GAVEA")).toBe("Gávea");
    expect(bairroPublic("Meier")).toBe("Méier");
    expect(bairroPublic("VILA ISABEL")).toBe("Vila Isabel");
  });
});
