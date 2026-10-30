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

// A RFB grava sem acento padronizado e guardamos assim (chave estável p/ filtros).
// No site público mostramos a grafia correta dos bairros mais comuns.
const ACCENTED: Record<string, string> = Object.fromEntries(
  [
    "Gávea", "Jardim Botânico", "Glória", "Humaitá", "Méier", "Grajaú", "Maracanã", "Andaraí",
    "Joá", "São Conrado", "São Cristóvão", "Jacarepaguá", "Abolição", "Saúde", "Estácio",
    "Itanhangá", "Galeão", "Praça da Bandeira", "Praça Seca", "Maré", "Gardênia Azul", "Irajá",
    "Inhaúma", "Tomás Coelho", "Ilha de Paquetá", "São Francisco Xavier", "Brás de Pina",
    "Turiaçu", "Senador Câmara", "Santíssimo", "Inhoaíba", "Paciência", "Honório Gurgel",
    "Quintino Bocaiúva", "Tauá", "Cocotá", "Bancários", "Cidade Universitária", "Higienópolis",
    "Maria da Graça", "Jacaré", "Água Santa", "Magalhães Bastos", "Freguesia (Jacarepaguá)",
    "Freguesia (Ilha do Governador)", "Penha Circular", "Vila da Penha", "Cascadura",
  ].map((n) => [bairroKey(n), n])
);

/** Grafia de exibição no site: com acento quando conhecido, senão Title Case. */
export function bairroPublic(raw: string): string {
  return ACCENTED[bairroKey(raw)] ?? bairroDisplay(raw);
}

// Preposição do bairro no texto do site: "na Tijuca", "no Leblon", "em Copacabana".
// No Rio o artigo é de uso (não de regra), então listamos os que levam artigo;
// o resto fica com "em"/"de", que nunca soa errado.
const FEMININE = new Set(
  [
    "TIJUCA", "GAVEA", "BARRA DA TIJUCA", "GLORIA", "LAGOA", "URCA", "PENHA", "PENHA CIRCULAR",
    "TAQUARA", "FREGUESIA", "FREGUESIA JACAREPAGUA", "ILHA DO GOVERNADOR", "PRACA DA BANDEIRA",
    "PAVUNA", "SAUDE", "GAMBOA", "VILA ISABEL", "VILA DA PENHA", "ABOLICAO", "PIEDADE",
    "PECHINCHA", "GARDENIA AZUL", "CIDADE NOVA", "CIDADE DE DEUS", "ROCINHA", "MARE",
    "PRACA SECA", "TIJUCA ALTA", "BARRA DE GUARATIBA", "ILHA DE PAQUETA", "PEDRA DE GUARATIBA",
  ].map(bairroKey)
);
const MASCULINE = new Set(
  [
    "LEBLON", "LEME", "FLAMENGO", "CATETE", "CENTRO", "HUMAITA", "MEIER", "GRAJAU", "MARACANA",
    "ANDARAI", "RIO COMPRIDO", "ANIL", "RECREIO DOS BANDEIRANTES", "JARDIM BOTANICO",
    "COSME VELHO", "JOA", "CACHAMBI", "ENGENHO DE DENTRO", "ENGENHO NOVO", "JARDIM GUANABARA",
    "ESTACIO", "CAJU", "ROCHA", "RIACHUELO", "ENCANTADO", "LINS DE VASCONCELOS", "ITANHANGA",
    "CAMORIM", "GALEAO", "JACAREZINHO", "ALTO DA BOA VISTA", "VIDIGAL", "CATUMBI",
    "JARDIM SULACAP", "RECREIO",
  ].map(bairroKey)
);

/** "na Tijuca" / "no Leblon" / "em Copacabana" (bairro já formatado para exibição). */
export function bairroEm(raw: string): string {
  const key = bairroKey(raw);
  const name = bairroPublic(raw);
  if (FEMININE.has(key)) return `na ${name}`;
  if (MASCULINE.has(key)) return `no ${name}`;
  return `em ${name}`;
}

/** "da Tijuca" / "do Leblon" / "de Copacabana". */
export function bairroDe(raw: string): string {
  const key = bairroKey(raw);
  const name = bairroPublic(raw);
  if (FEMININE.has(key)) return `da ${name}`;
  if (MASCULINE.has(key)) return `do ${name}`;
  return `de ${name}`;
}
