// Serper.dev — API de resultados do Google. 2.500 créditos grátis; depois ~US$1/1k.
import type { SearchResult, WebsiteFinder } from "./types";

export function serperFinder(apiKey: string): WebsiteFinder {
  return {
    name: "serper",
    async search(query: string): Promise<SearchResult[]> {
      const res = await fetch("https://google.serper.dev/search", {
        method: "POST",
        headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ q: query, gl: "br", hl: "pt-br", num: 10 }),
      });
      if (res.status === 429) throw new RateLimitError("serper 429");
      if (!res.ok) throw new Error(`serper ${res.status}: ${await res.text()}`);
      const data = (await res.json()) as { organic?: { link: string; title: string; snippet?: string }[] };
      return (data.organic ?? []).map((r) => ({ url: r.link, title: r.title, snippet: r.snippet }));
    },
  };
}

export class RateLimitError extends Error {}
