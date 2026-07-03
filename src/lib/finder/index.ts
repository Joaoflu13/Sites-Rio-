// Factory do finder por env: FINDER_PROVIDER = serper | google-cse | fake.
import type { WebsiteFinder } from "./types";
import { serperFinder } from "./serper";
import { googleCseFinder } from "./google-cse";
import { fakeFinder } from "./fake";

export function finderFromEnv(override?: string): WebsiteFinder {
  const provider = (override ?? process.env.FINDER_PROVIDER ?? "serper").toLowerCase();
  if (provider === "serper") {
    const key = process.env.SERPER_API_KEY;
    if (!key) throw new Error("Defina SERPER_API_KEY no .env (ou use outro FINDER_PROVIDER).");
    return serperFinder(key);
  }
  if (provider === "google-cse") {
    const key = process.env.GOOGLE_CSE_KEY;
    const cx = process.env.GOOGLE_CSE_CX;
    if (!key || !cx) throw new Error("Defina GOOGLE_CSE_KEY e GOOGLE_CSE_CX no .env.");
    return googleCseFinder(key, cx);
  }
  if (provider === "fake") return fakeFinder();
  throw new Error(`FINDER_PROVIDER desconhecido: ${provider}`);
}

export type { SearchResult, WebsiteFinder } from "./types";
export { RateLimitError } from "./serper";
