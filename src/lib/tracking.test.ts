import { describe, expect, it } from "vitest";
import { channelFromParam, demoLink, isBotUserAgent, timeAgo } from "./tracking";

describe("tracking", () => {
  it("canal pelo parâmetro c", () => {
    expect(channelFromParam("e")).toBe("email");
    expect(channelFromParam("w")).toBe("whatsapp");
    expect(channelFromParam("x")).toBe("");
    expect(channelFromParam(null)).toBe("");
  });

  it("robôs e pré-visualizadores não contam; navegador conta", () => {
    expect(isBotUserAgent("WhatsApp/2.23.20.0 A")).toBe(true);
    expect(isBotUserAgent("facebookexternalhit/1.1")).toBe(true);
    expect(isBotUserAgent("Mozilla/5.0 (compatible; Googlebot/2.1)")).toBe(true);
    expect(isBotUserAgent("Mozilla/5.0 HeadlessChrome/120.0")).toBe(true);
    expect(isBotUserAgent("")).toBe(true);
    expect(
      isBotUserAgent(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
      )
    ).toBe(false);
  });

  it("link da demo usa DEMO_BASE_URL quando existe", () => {
    const old = { ...process.env };
    process.env.APP_URL = "https://sites-rio.vercel.app";
    delete process.env.DEMO_BASE_URL;
    expect(demoLink("padaria-x-000191", "e")).toBe("https://sites-rio.vercel.app/s/padaria-x-000191?c=e");
    process.env.DEMO_BASE_URL = "https://meusite.com.br/";
    expect(demoLink("padaria-x-000191")).toBe("https://meusite.com.br/s/padaria-x-000191");
    process.env = old;
  });

  it("timeAgo", () => {
    const now = new Date("2026-11-05T12:00:00Z");
    expect(timeAgo(new Date("2026-11-05T11:55:00Z"), now)).toBe("há 5 min");
    expect(timeAgo(new Date("2026-11-05T09:00:00Z"), now)).toBe("há 3 h");
    expect(timeAgo(new Date("2026-11-03T12:00:00Z"), now)).toBe("há 2 dias");
  });
});
