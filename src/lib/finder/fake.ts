// Finder de mentira para testes: devolve fixtures registradas por query
// (ou nada). Nunca sai à rede.
import type { SearchResult, WebsiteFinder } from "./types";

export function fakeFinder(fixtures: Record<string, SearchResult[]> = {}): WebsiteFinder {
  return {
    name: "fake",
    async search(query: string): Promise<SearchResult[]> {
      // casa por inclusão para os testes não dependerem da query exata
      for (const [k, v] of Object.entries(fixtures)) {
        if (query.toLowerCase().includes(k.toLowerCase())) return v;
      }
      return [];
    },
  };
}
