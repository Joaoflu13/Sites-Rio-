// Abstração do "buscador de presença web": recebe uma query e devolve os
// primeiros resultados orgânicos. Implementações: serper.ts (Serper.dev),
// google-cse.ts (Google Custom Search) e fake.ts (fixtures para testes).

export type SearchResult = {
  url: string;
  title: string;
  snippet?: string;
};

export interface WebsiteFinder {
  name: string;
  search(query: string): Promise<SearchResult[]>;
}
