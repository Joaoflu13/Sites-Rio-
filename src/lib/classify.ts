// Classifica a presença web de um estabelecimento a partir dos resultados de
// busca. Função pura (testada em classify.test.ts) — o enrich.ts só orquestra.
//
// Regras:
// - Diretórios de CNPJ e afins são ruído: ignorados por completo.
// - Redes sociais e agregadores entram nas classes SOCIAL_ONLY/AGGREGATOR_ONLY.
// - Qualquer outro domínio só vira "site próprio" se o NOME casar (token
//   significativo no domínio ou sobreposição título×nome), para não marcar
//   homônimos/portais como site do estabelecimento.

import type { SearchResult } from "@/lib/finder/types";
import type { PresenceClass } from "@prisma/client";

const COMBINING_MARKS = new RegExp("[\\u0300-\\u036f]", "g");

// Ruído: aparecem para qualquer CNPJ, nunca são o site do negócio.
const DIRECTORY_NOISE = [
  "econodata.com.br", "cnpj.biz", "casadosdados.com.br", "consultacnpj.com",
  "empresaqui.com.br", "cnpja.com", "cnpj.info", "consultasocio.com",
  "jusbrasil.com.br", "escavador.com", "gov.br", "google.com", "listadeempresas.com.br",
  "empresascnpj.com", "informecadastral.com.br", "solutudo.com.br", "b2bhint.com",
];

const SOCIAL = [
  "instagram.com", "facebook.com", "wa.me", "whatsapp.com", "linktr.ee",
  "bio.link", "beacons.ai", "tiktok.com", "youtube.com", "x.com", "twitter.com",
];

const AGGREGATOR = [
  "ifood.com.br", "rappi.com.br", "ubereats.com", "aiqfome.com", "goomer.com.br",
  "tripadvisor.com", "tripadvisor.com.br", "booking.com", "airbnb.com",
  "doctoralia.com.br", "boaconsulta.com", "docplanner.com",
  "guiamais.com.br", "apontador.com.br", "telelistas.net", "getninjas.com.br",
  "kekanto.com.br", "nibo.com.br", "hotmart.com", "ancoradouro.net",
];

// Palavras que não identificam o negócio (não contam como token significativo).
const STOPWORDS = new Set([
  "de", "da", "do", "das", "dos", "e", "em", "com", "para", "ltda", "eireli",
  "me", "epp", "sa", "restaurante", "bar", "padaria", "academia", "salao",
  "clinica", "consultorio", "loja", "comercio", "servicos", "centro", "casa",
  "rio", "janeiro", "carioca",
]);

export type Evidence = {
  provider: string;
  query: string;
  results: { url: string; title: string; matchedAs: string }[];
};

export type Classification = {
  presenceClass: PresenceClass;
  websiteUrl: string;
  socialUrl: string;
  evidence: Evidence;
};

function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Domínio registrado (host sem www). */
export function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function inList(domain: string, list: string[]): boolean {
  return list.some((d) => domain === d || domain.endsWith("." + d));
}

/** Tokens do nome que identificam o negócio (≥4 chars, fora das stopwords). */
function significantTokens(name: string): string[] {
  return normalize(name)
    .split(" ")
    .filter((t) => t.length >= 4 && !STOPWORDS.has(t));
}

/** Sobreposição de tokens (Jaccard) entre título do resultado e nome. */
function jaccard(a: string, b: string): number {
  const ta = new Set(normalize(a).split(" ").filter(Boolean));
  const tb = new Set(normalize(b).split(" ").filter(Boolean));
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  return inter / (ta.size + tb.size - inter);
}

/** true se o domínio/título parecem realmente ser DO estabelecimento. */
function nameMatches(displayName: string, domain: string, title: string): boolean {
  const tokens = significantTokens(displayName);
  const domainFlat = domain.replace(/[^a-z0-9]/g, "");
  if (tokens.some((t) => domainFlat.includes(t))) return true;
  return jaccard(title, displayName) >= 0.5;
}

export function classifyPresence(
  displayName: string,
  results: SearchResult[],
  meta: { provider: string; query: string }
): Classification {
  const evidence: Evidence = { provider: meta.provider, query: meta.query, results: [] };
  let websiteUrl = "";
  let socialUrl = "";
  let sawSocial = false;
  let sawAggregator = false;

  for (const r of results.slice(0, 10)) {
    const domain = domainOf(r.url);
    if (!domain) continue;

    let matchedAs = "ignorado";
    if (inList(domain, DIRECTORY_NOISE)) {
      matchedAs = "diretorio";
    } else if (inList(domain, SOCIAL)) {
      // Só conta a rede social se o resultado tiver a ver com o nome.
      if (nameMatches(displayName, domain, r.title)) {
        sawSocial = true;
        matchedAs = "social";
        // guarda o primeiro perfil; Instagram tem prioridade sobre os demais
        const isInsta = domain.includes("instagram");
        const currentIsInsta = domainOf(socialUrl).includes("instagram");
        if (!socialUrl || (isInsta && !currentIsInsta)) socialUrl = r.url;
      } else {
        matchedAs = "social-homonimo";
      }
    } else if (inList(domain, AGGREGATOR)) {
      if (nameMatches(displayName, domain, r.title)) {
        sawAggregator = true;
        matchedAs = "agregador";
      } else {
        matchedAs = "agregador-homonimo";
      }
    } else if (nameMatches(displayName, domain, r.title)) {
      matchedAs = "site-proprio";
      if (!websiteUrl) websiteUrl = r.url;
    }

    if (evidence.results.length < 5) {
      evidence.results.push({ url: r.url, title: r.title, matchedAs });
    }
  }

  const presenceClass: PresenceClass = websiteUrl
    ? "HAS_SITE"
    : sawSocial
      ? "SOCIAL_ONLY"
      : sawAggregator
        ? "AGGREGATOR_ONLY"
        : "NO_SITE";

  return { presenceClass, websiteUrl, socialUrl, evidence };
}
