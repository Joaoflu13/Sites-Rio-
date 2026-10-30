import { describe, expect, it } from "vitest";
import { buildPitch } from "./pitch";

const base = { name: "Padaria Estrela", websiteUrl: "", demoUrl: "https://x.app/s/padaria-estrela-000191" };

describe("buildPitch", () => {
  it("sem site: argumento do Google + link da demo + preço", () => {
    const p = buildPitch({ ...base, presenceClass: "NO_SITE" });
    expect(p).toContain("ainda não tem site próprio");
    expect(p).toContain(base.demoUrl);
    expect(p).toContain("R$ 497");
  });

  it("só Instagram: elogia a rede e não diz que não existe na web", () => {
    const p = buildPitch({ ...base, presenceClass: "SOCIAL_ONLY" });
    expect(p).toContain("Instagram");
    expect(p).not.toContain("ainda não tem site próprio");
  });

  it("só agregador: argumento da comissão", () => {
    expect(buildPitch({ ...base, presenceClass: "AGGREGATOR_ONLY" })).toContain("comissão");
  });

  it("negocio.site: avisa que o site do Google saiu do ar", () => {
    const p = buildPitch({
      ...base,
      presenceClass: "WEAK_SITE",
      websiteUrl: "https://padariaestrela.negocio.site/",
    });
    expect(p).toContain("saiu do ar");
    expect(p).toContain("padariaestrela.negocio.site");
  });

  it("outro construtor grátis: argumento do endereço gratuito", () => {
    const p = buildPitch({
      ...base,
      presenceClass: "WEAK_SITE",
      websiteUrl: "https://padariaestrela.wixsite.com/home",
    });
    expect(p).toContain("endereço gratuito (padariaestrela.wixsite.com)");
  });

  it("começa com maiúscula depois do Olá", () => {
    expect(buildPitch({ ...base, presenceClass: "NO_SITE" })).toMatch(/^Olá! F/);
  });
});
