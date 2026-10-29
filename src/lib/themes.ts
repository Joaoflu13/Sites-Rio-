// Temas do site demo: 1 template, 7 variações por grupo CNAE.
// Cores, fonte, fotos, tagline, texto "sobre", destaques e CTA default — textos
// substituíveis depois da venda via DemoSite (admin).

/** Fonte dos títulos (carregadas em src/app/s/[slug]/fonts.ts). */
export type ThemeFont = "fraunces" | "playfair" | "manrope" | "oswald" | "nunito" | "outfit";

/** Ícones disponíveis (mapeados para lucide-react em src/app/s/[slug]/icons.tsx). */
export type ThemeIcon =
  | "utensils" | "flame" | "bike" | "star" | "sparkles" | "calendar" | "scissors"
  | "stethoscope" | "heart-handshake" | "map-pin" | "dumbbell" | "clock" | "target"
  | "paw" | "bath" | "bone" | "heart" | "bag" | "tag" | "message" | "handshake"
  | "wrench" | "check" | "timer";

export type AboutContext = {
  name: string;
  /** "na Tijuca" / "no Leblon" / "em Copacabana" */
  em: string;
  /** "da Tijuca" / "do Leblon" / "de Copacabana" */
  de: string;
  /** "Tijuca" */
  bairro: string;
};

export type SiteTheme = {
  /** gradiente de fundo (aparece sob a foto e substitui a foto se ela falhar) */
  heroBg: string;
  /** cor de destaque (botões, ícones) */
  accent: string;
  /** cor de texto sobre o accent */
  accentText: string;
  /** tom escuro do segmento (faixa de CTA, sobreposição da foto) */
  dark: string;
  /** fundo claro das seções alternadas */
  soft: string;
  font: ThemeFont;
  /** títulos em caixa alta (estilo "academia") */
  uppercase?: boolean;
  icon: ThemeIcon;
  /** IDs de fotos do Unsplash (licença livre p/ uso comercial); 1 por site, fixa pelo CNPJ */
  photos: string[];
  tagline: string;
  ctaLabel: string;
  about: (c: AboutContext) => string;
  highlights: { icon: ThemeIcon; title: string; text: string }[];
};

const THEMES: Record<string, SiteTheme> = {
  FOOD: {
    heroBg: "linear-gradient(135deg, #431407 0%, #9a3412 50%, #ea580c 100%)",
    accent: "#c2410c",
    accentText: "#fff",
    dark: "#2a0f05",
    soft: "#fff7ed",
    font: "fraunces",
    icon: "utensils",
    photos: [
      "1509440159596-0249088772ff",
      "1555396273-367ea4eb4db5",
      "1517248135467-4c7edcad34c4",
      "1504674900247-0877df9cc836",
    ],
    tagline: "Sabor de verdade, pertinho de você",
    ctaLabel: "Peça pelo WhatsApp",
    about: (c) =>
      `${c.name} faz parte do dia a dia ${c.de}: ingredientes frescos, preparo caprichado e atendimento de gente que conhece você pelo nome.`,
    highlights: [
      { icon: "flame", title: "Feito na hora", text: "Tudo preparado no capricho, do jeito que você gosta." },
      { icon: "bike", title: "Peça sem sair de casa", text: "Chame no WhatsApp e combine a retirada ou entrega." },
      { icon: "star", title: "Tradição do bairro", text: "Qualidade que os vizinhos já conhecem e recomendam." },
    ],
  },
  BEAUTY: {
    heroBg: "linear-gradient(135deg, #500724 0%, #9d174d 50%, #db2777 100%)",
    accent: "#9d174d",
    accentText: "#fff",
    dark: "#2d0414",
    soft: "#fdf2f8",
    font: "playfair",
    icon: "sparkles",
    photos: [
      "1560066984-138dadb4c035",
      "1522337360788-8b13dee7a37e",
      "1604654894610-df63bc536371",
      "1487412947147-5cebf100ffc2",
    ],
    tagline: "Sua beleza, do seu jeito",
    ctaLabel: "Agende seu horário",
    about: (c) =>
      `${c.name}, ${c.em}, é cuidado de verdade: profissionais experientes, produtos de qualidade e atenção pensada para você sair com a autoestima lá em cima.`,
    highlights: [
      { icon: "sparkles", title: "Atendimento personalizado", text: "Seu estilo e seu tempo são a prioridade." },
      { icon: "calendar", title: "Horário marcado", text: "Agende pelo WhatsApp e evite espera." },
      { icon: "scissors", title: "Do cabelo às unhas", text: "Tudo em um só lugar, com profissionais dedicados." },
    ],
  },
  HEALTH: {
    heroBg: "linear-gradient(135deg, #083344 0%, #0e7490 50%, #06b6d4 100%)",
    accent: "#0e7490",
    accentText: "#fff",
    dark: "#04222d",
    soft: "#ecfeff",
    font: "manrope",
    icon: "stethoscope",
    photos: [
      "1576091160550-2173dba999ef",
      "1579684385127-1ef15d508118",
      "1588776814546-1ffcf47267a5",
      "1505751172876-fa1923c5c528",
    ],
    tagline: "Cuidando de você com atenção e experiência",
    ctaLabel: "Agende sua consulta",
    about: (c) =>
      `${c.name} atende ${c.em} com foco no que importa: escuta atenta, diagnóstico cuidadoso e acompanhamento próximo de cada paciente.`,
    highlights: [
      { icon: "heart-handshake", title: "Atendimento humanizado", text: "Você é ouvido com calma, sem pressa." },
      { icon: "calendar", title: "Agenda facilitada", text: "Marque sua consulta direto pelo WhatsApp." },
      { icon: "map-pin", title: "Fácil acesso", text: "Localização conveniente, pertinho de você." },
    ],
  },
  FITNESS: {
    heroBg: "linear-gradient(135deg, #020617 0%, #14532d 55%, #16a34a 100%)",
    accent: "#16a34a",
    accentText: "#fff",
    dark: "#020617",
    soft: "#f0fdf4",
    font: "oswald",
    uppercase: true,
    icon: "dumbbell",
    photos: [
      "1534438327276-14e5300c3a48",
      "1571019613454-1cb2f99b2d8b",
      "1517836357463-d25dfeac3438",
      "1540497077202-7c8a3999166f",
    ],
    tagline: "Comece hoje. Sinta a diferença.",
    ctaLabel: "Agende uma aula experimental",
    about: (c) =>
      `${c.name}, ${c.em}, faz treinar deixar de ser obrigação: estrutura completa, professores presentes e uma comunidade que motiva você a voltar todos os dias.`,
    highlights: [
      { icon: "dumbbell", title: "Treino orientado", text: "Acompanhamento de verdade, do iniciante ao avançado." },
      { icon: "clock", title: "Horários flexíveis", text: "Treine no horário que encaixa na sua rotina." },
      { icon: "target", title: "Foco no resultado", text: "Planos de treino pensados para o seu objetivo." },
    ],
  },
  PET: {
    heroBg: "linear-gradient(135deg, #451a03 0%, #b45309 50%, #f59e0b 100%)",
    accent: "#b45309",
    accentText: "#fff",
    dark: "#2b1002",
    soft: "#fffbeb",
    font: "nunito",
    icon: "paw",
    photos: [
      "1548199973-03cce0bbc87b",
      "1587300003388-59208cc962cb",
      "1543466835-00a7907e9de1",
      "1514888286974-6c03e2ca1dba",
    ],
    tagline: "Carinho e cuidado para o seu melhor amigo",
    ctaLabel: "Fale com a gente",
    about: (c) =>
      `${c.name} cuida dos pets ${c.de} como se fossem da família: atendimento carinhoso, produtos selecionados e todo o cuidado que seu companheiro merece.`,
    highlights: [
      { icon: "bath", title: "Banho & tosa com carinho", text: "Seu pet tratado com paciência e atenção." },
      { icon: "bone", title: "Tudo para o seu pet", text: "Ração, acessórios e produtos de qualidade." },
      { icon: "heart", title: "Amor por animais", text: "Equipe apaixonada pelo que faz." },
    ],
  },
  RETAIL: {
    heroBg: "linear-gradient(135deg, #1e1b4b 0%, #3730a3 50%, #6366f1 100%)",
    accent: "#4338ca",
    accentText: "#fff",
    dark: "#13112e",
    soft: "#eef2ff",
    font: "outfit",
    icon: "bag",
    photos: [
      "1441986300917-64674bd600d8",
      "1555529669-e69e7aa0ba9a",
      "1472851294608-062f824d29cc",
      "1604719312566-8912e9227c6a",
    ],
    tagline: "O que você procura, aqui no bairro",
    ctaLabel: "Consulte pelo WhatsApp",
    about: (c) =>
      `${c.name} é referência ${c.em}: variedade, preço justo e aquele atendimento próximo que só o comércio de bairro tem.`,
    highlights: [
      { icon: "tag", title: "Preço justo", text: "Qualidade sem pesar no bolso." },
      { icon: "message", title: "Consulta rápida", text: "Pergunte a disponibilidade pelo WhatsApp." },
      { icon: "handshake", title: "Atendimento de verdade", text: "Gente que entende e ajuda a escolher." },
    ],
  },
  SERVICES: {
    heroBg: "linear-gradient(135deg, #0f172a 0%, #1e3a8a 55%, #2563eb 100%)",
    accent: "#1d4ed8",
    accentText: "#fff",
    dark: "#0b1222",
    soft: "#eff6ff",
    font: "manrope",
    icon: "wrench",
    photos: [
      "1497366216548-37526070297c",
      "1521791136064-7986c2920216",
      "1486406146926-c627a92ad1ab",
      "1566073771259-6a8506099945",
    ],
    tagline: "Serviço bem feito, sem dor de cabeça",
    ctaLabel: "Peça um orçamento",
    about: (c) =>
      `${c.name} atende ${c.bairro} e região com o compromisso de sempre: serviço profissional, prazo cumprido e preço combinado sem surpresa.`,
    highlights: [
      { icon: "check", title: "Profissionais experientes", text: "Trabalho bem feito na primeira vez." },
      { icon: "timer", title: "Agilidade", text: "Orçamento rápido pelo WhatsApp." },
      { icon: "handshake", title: "Confiança", text: "Transparência do orçamento à entrega." },
    ],
  },
};

/** Tema do grupo CNAE (fallback: SERVICES). */
export function themeFor(group: string): SiteTheme {
  return THEMES[group] ?? THEMES.SERVICES;
}

/** URL da foto do Unsplash no tamanho pedido. */
export function photoUrl(id: string, width: number): string {
  return `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${width}&q=70`;
}

/**
 * Variação estável por estabelecimento (hash do CNPJ): qual foto e qual
 * layout de hero. Vizinhos do mesmo segmento não ficam com sites idênticos,
 * e o mesmo site nunca muda entre visitas.
 */
export function siteVariant(cnpj: string, photoCount: number): { photo: number; layout: "cover" | "split" } {
  let h = 2166136261;
  for (const ch of cnpj) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return { photo: photoCount ? h % photoCount : 0, layout: (h >>> 8) % 2 === 0 ? "cover" : "split" };
}

/** Preço exibido na faixa de demonstração. */
export const OFFER = { setup: "R$ 497", monthly: "R$ 79/mês" };
