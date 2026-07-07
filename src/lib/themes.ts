// Temas do site demo: 1 template, 7 variações por grupo CNAE.
// Cores, tagline, texto "sobre", destaques e CTA default — tudo substituível
// depois da venda via DemoSite (admin).

export type SiteTheme = {
  /** gradiente do hero (CSS) */
  heroBg: string;
  /** cor de destaque (botões, títulos) */
  accent: string;
  /** cor de texto sobre o accent */
  accentText: string;
  /** fundo claro das seções alternadas */
  soft: string;
  /** emoji "marca" do segmento */
  icon: string;
  tagline: string;
  ctaLabel: string;
  about: (name: string, bairro: string) => string;
  highlights: { icon: string; title: string; text: string }[];
};

const THEMES: Record<string, SiteTheme> = {
  FOOD: {
    heroBg: "linear-gradient(135deg, #7c2d12 0%, #c2410c 45%, #ea580c 100%)",
    accent: "#ea580c",
    accentText: "#fff",
    soft: "#fff7ed",
    icon: "🍽️",
    tagline: "Sabor de verdade, pertinho de você",
    ctaLabel: "Peça pelo WhatsApp",
    about: (name, bairro) =>
      `${name} faz a diferença no dia a dia de ${bairro}: ingredientes frescos, preparo caprichado e atendimento de gente que conhece você pelo nome.`,
    highlights: [
      { icon: "🔥", title: "Feito na hora", text: "Tudo preparado no capricho, do jeito que você gosta." },
      { icon: "🛵", title: "Peça sem sair de casa", text: "Chame no WhatsApp e combine a retirada ou entrega." },
      { icon: "⭐", title: "Tradição do bairro", text: "Qualidade que os vizinhos já conhecem e recomendam." },
    ],
  },
  BEAUTY: {
    heroBg: "linear-gradient(135deg, #831843 0%, #be185d 50%, #ec4899 100%)",
    accent: "#be185d",
    accentText: "#fff",
    soft: "#fdf2f8",
    icon: "💇",
    tagline: "Você mais bonita, do seu jeito",
    ctaLabel: "Agende seu horário",
    about: (name, bairro) =>
      `${name}, em ${bairro}, é cuidado de verdade: profissionais experientes, produtos de qualidade e atenção pensada para você sair renovada.`,
    highlights: [
      { icon: "✨", title: "Atendimento personalizado", text: "Seu estilo e seu tempo são a prioridade." },
      { icon: "📅", title: "Horário marcado", text: "Agende pelo WhatsApp e evite espera." },
      { icon: "💅", title: "Do cabelo às unhas", text: "Tudo em um só lugar, com profissionais dedicados." },
    ],
  },
  HEALTH: {
    heroBg: "linear-gradient(135deg, #0c4a6e 0%, #0369a1 50%, #0ea5e9 100%)",
    accent: "#0369a1",
    accentText: "#fff",
    soft: "#f0f9ff",
    icon: "🩺",
    tagline: "Cuidando de você com atenção e experiência",
    ctaLabel: "Agende sua consulta",
    about: (name, bairro) =>
      `${name} atende em ${bairro} com foco no que importa: escuta atenta, diagnóstico cuidadoso e acompanhamento próximo de cada paciente.`,
    highlights: [
      { icon: "🤝", title: "Atendimento humanizado", text: "Você é ouvido com calma, sem pressa." },
      { icon: "📅", title: "Agenda facilitada", text: "Marque sua consulta direto pelo WhatsApp." },
      { icon: "📍", title: "Fácil acesso", text: "Localização conveniente, pertinho de você." },
    ],
  },
  FITNESS: {
    heroBg: "linear-gradient(135deg, #052e16 0%, #14532d 45%, #16a34a 100%)",
    accent: "#16a34a",
    accentText: "#fff",
    soft: "#f0fdf4",
    icon: "💪",
    tagline: "Comece hoje. Sinta a diferença.",
    ctaLabel: "Agende uma aula experimental",
    about: (name, bairro) =>
      `${name}, em ${bairro}, faz treinar deixar de ser obrigação: estrutura completa, professores presentes e uma comunidade que motiva você a voltar todos os dias.`,
    highlights: [
      { icon: "🏋️", title: "Treino orientado", text: "Acompanhamento de verdade, do iniciante ao avançado." },
      { icon: "⏰", title: "Horários flexíveis", text: "Treine no horário que encaixa na sua rotina." },
      { icon: "🎯", title: "Resultado", text: "Planos de treino focados no seu objetivo." },
    ],
  },
  PET: {
    heroBg: "linear-gradient(135deg, #7c2d12 0%, #b45309 50%, #f59e0b 100%)",
    accent: "#d97706",
    accentText: "#fff",
    soft: "#fffbeb",
    icon: "🐾",
    tagline: "Carinho e cuidado para o seu melhor amigo",
    ctaLabel: "Fale com a gente",
    about: (name, bairro) =>
      `${name} cuida dos pets de ${bairro} como se fossem da família: atendimento carinhoso, produtos selecionados e todo o cuidado que seu companheiro merece.`,
    highlights: [
      { icon: "🛁", title: "Banho & tosa com carinho", text: "Seu pet tratado com paciência e atenção." },
      { icon: "🦴", title: "Tudo para o seu pet", text: "Ração, acessórios e produtos de qualidade." },
      { icon: "❤️", title: "Amor por animais", text: "Equipe apaixonada pelo que faz." },
    ],
  },
  RETAIL: {
    heroBg: "linear-gradient(135deg, #1e1b4b 0%, #3730a3 50%, #4f46e5 100%)",
    accent: "#4338ca",
    accentText: "#fff",
    soft: "#eef2ff",
    icon: "🛍️",
    tagline: "O que você procura, aqui no bairro",
    ctaLabel: "Consulte pelo WhatsApp",
    about: (name, bairro) =>
      `${name} é referência em ${bairro}: variedade, preço justo e aquele atendimento próximo que só o comércio de bairro tem.`,
    highlights: [
      { icon: "🏷️", title: "Preço justo", text: "Qualidade sem pesar no bolso." },
      { icon: "💬", title: "Consulta rápida", text: "Pergunte a disponibilidade pelo WhatsApp." },
      { icon: "🤝", title: "Atendimento de verdade", text: "Gente que entende e ajuda a escolher." },
    ],
  },
  SERVICES: {
    heroBg: "linear-gradient(135deg, #0f172a 0%, #1e3a8a 55%, #2563eb 100%)",
    accent: "#2563eb",
    accentText: "#fff",
    soft: "#eff6ff",
    icon: "🔧",
    tagline: "Serviço bem feito, sem dor de cabeça",
    ctaLabel: "Peça um orçamento",
    about: (name, bairro) =>
      `${name} atende ${bairro} e região com o compromisso de sempre: serviço profissional, prazo cumprido e preço combinado sem surpresa.`,
    highlights: [
      { icon: "✅", title: "Profissionais experientes", text: "Trabalho bem feito na primeira vez." },
      { icon: "⏱️", title: "Agilidade", text: "Orçamento rápido pelo WhatsApp." },
      { icon: "🤝", title: "Confiança", text: "Transparência do orçamento à entrega." },
    ],
  },
};

/** Tema do grupo CNAE (fallback: SERVICES). */
export function themeFor(group: string): SiteTheme {
  return THEMES[group] ?? THEMES.SERVICES;
}

/** Preço exibido na faixa de demonstração. */
export const OFFER = { setup: "R$ 497", monthly: "R$ 79/mês" };
