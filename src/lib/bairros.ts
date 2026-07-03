// Normalização de bairros (a RFB grava em MAIÚSCULAS, sem padrão de acento)
// e mapa de tiers para o score. Dados estáticos de referência: ficam em código,
// não em tabela, para poupar o orçamento de 500MB do Supabase free.

const COMBINING_MARKS = new RegExp("[\\u0300-\\u036f]", "g");

/** Chave canônica de comparação: maiúsculas, sem acento, espaços colapsados. */
export function bairroKey(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Exibição: Title Case simples (preposições minúsculas). */
export function bairroDisplay(raw: string): string {
  const small = new Set(["DA", "DE", "DO", "DAS", "DOS", "E"]);
  return bairroKey(raw)
    .split(" ")
    .map((w, i) =>
      small.has(w) && i > 0 ? w.toLowerCase() : w.charAt(0) + w.slice(1).toLowerCase()
    )
    .join(" ");
}

// Tier 1: Zona Sul + Barra/Recreio + Centro — maior poder aquisitivo/ticket.
const TIER1 = new Set(
  [
    "COPACABANA", "LEME", "IPANEMA", "LEBLON", "BOTAFOGO", "FLAMENGO", "CATETE",
    "LARANJEIRAS", "COSME VELHO", "HUMAITA", "URCA", "LAGOA", "JARDIM BOTANICO",
    "GAVEA", "SAO CONRADO", "JOA", "BARRA DA TIJUCA", "RECREIO DOS BANDEIRANTES",
    "CENTRO", "GLORIA", "SANTA TERESA",
  ].map(bairroKey)
);

// Tier 2: Grande Tijuca, Grande Méier, Ilha, Jacarepaguá — bom volume comercial.
const TIER2 = new Set(
  [
    "TIJUCA", "VILA ISABEL", "GRAJAU", "MARACANA", "ANDARAI", "RIO COMPRIDO",
    "MEIER", "TODOS OS SANTOS", "CACHAMBI", "ENGENHO DE DENTRO", "PIEDADE",
    "JARDIM GUANABARA", "FREGUESIA", "FREGUESIA JACAREPAGUA", "TAQUARA",
    "PECHINCHA", "ANIL", "JACAREPAGUA", "VARGEM PEQUENA", "VARGEM GRANDE",
    "VILA DA PENHA", "PENHA", "MADUREIRA", "CAMPO GRANDE", "BANGU",
    "ILHA DO GOVERNADOR", "SAO CRISTOVAO", "BONSUCESSO",
  ].map(bairroKey)
);

/** Tier do bairro para o score: 1 (melhor), 2 ou 3 (default). */
export function bairroTier(raw: string): 1 | 2 | 3 {
  const key = bairroKey(raw);
  if (TIER1.has(key)) return 1;
  if (TIER2.has(key)) return 2;
  return 3;
}
