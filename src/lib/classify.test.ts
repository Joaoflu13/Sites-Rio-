import { describe, expect, it } from "vitest";
import { classifyPresence, domainOf } from "./classify";

const meta = { provider: "fake", query: "teste" };

describe("domainOf", () => {
  it("extrai domínio sem www", () => {
    expect(domainOf("https://www.padariaestrela.com.br/sobre")).toBe("padariaestrela.com.br");
    expect(domainOf("lixo")).toBe("");
  });
});

describe("classifyPresence", () => {
  it("NO_SITE quando não há resultados", () => {
    const c = classifyPresence("Padaria Estrela da Gávea", [], meta);
    expect(c.presenceClass).toBe("NO_SITE");
    expect(c.websiteUrl).toBe("");
  });

  it("NO_SITE quando só há diretórios de CNPJ (ruído)", () => {
    const c = classifyPresence("Padaria Estrela da Gávea", [
      { url: "https://www.econodata.com.br/empresas/x", title: "PADARIA ESTRELA DA GAVEA - CNPJ" },
      { url: "https://cnpj.biz/11111111000191", title: "PADARIA ESTRELA DA GAVEA LTDA" },
    ], meta);
    expect(c.presenceClass).toBe("NO_SITE");
  });

  it("HAS_SITE quando o domínio contém token do nome", () => {
    const c = classifyPresence("Padaria Estrela da Gávea", [
      { url: "https://padariaestrela.com.br", title: "Padaria Estrela — desde 1990" },
    ], meta);
    expect(c.presenceClass).toBe("HAS_SITE");
    expect(c.websiteUrl).toBe("https://padariaestrela.com.br");
  });

  it("HAS_SITE por sobreposição de título mesmo com domínio genérico", () => {
    const c = classifyPresence("Clínica Sorriso Carioca", [
      { url: "https://sorrisoclinicaodonto.negocio.site", title: "Clínica Sorriso Carioca — Odontologia" },
    ], meta);
    expect(c.presenceClass).toBe("HAS_SITE");
  });

  it("NÃO marca HAS_SITE para homônimo/portal sem relação com o nome", () => {
    const c = classifyPresence("Padaria Estrela da Gávea", [
      { url: "https://g1globo.example.com/rio", title: "Melhores padarias do Rio de Janeiro" },
    ], meta);
    expect(c.presenceClass).toBe("NO_SITE");
  });

  it("SOCIAL_ONLY com Instagram compatível", () => {
    const c = classifyPresence("Academia Corpo em Forma", [
      { url: "https://www.instagram.com/corpoemforma", title: "Academia Corpo em Forma (@corpoemforma)" },
      { url: "https://www.econodata.com.br/x", title: "ACADEMIA CORPO EM FORMA" },
    ], meta);
    expect(c.presenceClass).toBe("SOCIAL_ONLY");
    expect(c.socialUrl).toContain("instagram.com");
  });

  it("prioriza Instagram sobre Facebook como socialUrl", () => {
    const c = classifyPresence("Academia Corpo em Forma", [
      { url: "https://www.facebook.com/corpoemforma", title: "Academia Corpo em Forma" },
      { url: "https://www.instagram.com/corpoemforma", title: "Academia Corpo em Forma (@corpoemforma)" },
    ], meta);
    expect(c.socialUrl).toContain("instagram.com");
  });

  it("AGGREGATOR_ONLY com iFood compatível", () => {
    const c = classifyPresence("Restaurante Sabor Carioca", [
      { url: "https://www.ifood.com.br/delivery/rio/sabor-carioca", title: "Sabor Carioca — iFood" },
    ], meta);
    expect(c.presenceClass).toBe("AGGREGATOR_ONLY");
  });

  it("site próprio vence social e agregador", () => {
    const c = classifyPresence("Restaurante Sabor Carioca", [
      { url: "https://www.instagram.com/saborcarioca", title: "Sabor Carioca (@saborcarioca)" },
      { url: "https://www.ifood.com.br/delivery/rio/sabor-carioca", title: "Sabor Carioca — iFood" },
      { url: "https://saborcarioca.com.br", title: "Restaurante Sabor Carioca" },
    ], meta);
    expect(c.presenceClass).toBe("HAS_SITE");
    expect(c.websiteUrl).toBe("https://saborcarioca.com.br");
    expect(c.socialUrl).toContain("instagram.com");
  });

  it("guarda no máximo 5 evidências com o veredito de cada uma", () => {
    const results = Array.from({ length: 8 }, (_, i) => ({
      url: `https://site${i}.example.com`,
      title: `Resultado ${i}`,
    }));
    const c = classifyPresence("Padaria Estrela", results, meta);
    expect(c.evidence.results).toHaveLength(5);
    expect(c.evidence.results[0].matchedAs).toBeDefined();
  });
});
