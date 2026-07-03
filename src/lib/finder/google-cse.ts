// Google Custom Search JSON API — 100 buscas/dia grátis (bom p/ smoke test).
import type { SearchResult, WebsiteFinder } from "./types";
import { RateLimitError } from "./serper";

export function googleCseFinder(key: string, cx: string): WebsiteFinder {
  return {
    name: "google-cse",
    async search(query: string): Promise<SearchResult[]> {
      const url = new URL("https://www.googleapis.com/customsearch/v1");
      url.searchParams.set("key", key);
      url.searchParams.set("cx", cx);
      url.searchParams.set("q", query);
      url.searchParams.set("gl", "br");
      url.searchParams.set("num", "10");
      const res = await fetch(url);
      if (res.status === 429) throw new RateLimitError("google-cse 429 (cota diária?)");
      if (!res.ok) throw new Error(`google-cse ${res.status}: ${await res.text()}`);
      const data = (await res.json()) as { items?: { link: string; title: string; snippet?: string }[] };
      return (data.items ?? []).map((r) => ({ url: r.link, title: r.title, snippet: r.snippet }));
    },
  };
}
