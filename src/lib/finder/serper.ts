// Serper.dev — API de resultados do Google. 2.500 créditos grátis; depois ~US$1/1k.
import type { SearchResult, WebsiteFinder } from "./types";

type SerperResponse = {
  organic?: { link: string; title: string; snippet?: string }[];
  // painel do Google Meu Negócio, quando a busca casa com um perfil
  knowledgeGraph?: { title?: string; website?: string; description?: string };
};

/** Resultados orgânicos, com o site do painel do Google (se houver) na frente. */
export function serperResults(data: SerperResponse): SearchResult[] {
  const results = (data.organic ?? []).map((r) => ({ url: r.link, title: r.title, snippet: r.snippet }));
  const kg = data.knowledgeGraph;
  if (kg?.website && !results.some((r) => r.url === kg.website)) {
    // mesmo crédito, sinal mais forte: é o site que o próprio dono cadastrou no Google
    results.unshift({ url: kg.website, title: kg.title ?? "", snippet: kg.description });
  }
  return results;
}

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
      return serperResults((await res.json()) as SerperResponse);
    },
  };
}

export class RateLimitError extends Error {}
