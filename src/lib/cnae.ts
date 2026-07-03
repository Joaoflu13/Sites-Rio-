// Categorias CNAE que o Sites Rio importa da base da Receita Federal.
// `valueWeight` (0–25) reflete o ticket típico de um site para o segmento e entra no score.
// Os códigos seguem a tabela CNAE 2.x da RFB (7 dígitos, sem pontuação) — confira contra o
// Cnaes.zip do dump antes da primeira ingestão completa (npm run ingest -- --check-cnaes).
// A lista é config: desligar uma categoria = CnaeCategory.enabled=false no banco.

export type CnaeGroup =
  | "FOOD"
  | "BEAUTY"
  | "HEALTH"
  | "FITNESS"
  | "PET"
  | "RETAIL"
  | "SERVICES";

export type CnaeDef = {
  code: string;
  label: string;
  group: CnaeGroup;
  valueWeight: number;
};

export const CNAE_STARTER: CnaeDef[] = [
  // FOOD — volume alto, ticket médio
  { code: "5611201", label: "Restaurantes e similares", group: "FOOD", valueWeight: 22 },
  { code: "5611203", label: "Lanchonetes, casas de chá, sucos", group: "FOOD", valueWeight: 20 },
  { code: "5611204", label: "Bares (sem entretenimento)", group: "FOOD", valueWeight: 20 },
  { code: "5611205", label: "Bares (com entretenimento)", group: "FOOD", valueWeight: 20 },
  { code: "4721102", label: "Padarias e confeitarias", group: "FOOD", valueWeight: 20 },
  { code: "4722901", label: "Açougues", group: "FOOD", valueWeight: 16 },
  { code: "4724500", label: "Hortifrutigranjeiros", group: "FOOD", valueWeight: 14 },
  { code: "5620104", label: "Marmitas / comida para consumo domiciliar", group: "FOOD", valueWeight: 18 },

  // BEAUTY — volume altíssimo (muito MEI), ticket menor
  { code: "9602501", label: "Cabeleireiros, manicure e pedicure", group: "BEAUTY", valueWeight: 12 },
  { code: "9602502", label: "Estética e cuidados com a beleza", group: "BEAUTY", valueWeight: 14 },

  // FITNESS
  { code: "9313100", label: "Academias e condicionamento físico", group: "FITNESS", valueWeight: 18 },

  // PET
  { code: "4789004", label: "Petshops (artigos e alimentos p/ animais)", group: "PET", valueWeight: 16 },
  { code: "9609208", label: "Banho e tosa", group: "PET", valueWeight: 14 },
  { code: "7500100", label: "Clínicas veterinárias", group: "PET", valueWeight: 20 },

  // HEALTH — maior ticket
  { code: "8630501", label: "Clínica médica (com procedimentos)", group: "HEALTH", valueWeight: 25 },
  { code: "8630502", label: "Clínica médica (exames complementares)", group: "HEALTH", valueWeight: 25 },
  { code: "8630503", label: "Consultório médico (consultas)", group: "HEALTH", valueWeight: 25 },
  { code: "8630504", label: "Odontologia", group: "HEALTH", valueWeight: 25 },
  { code: "8650002", label: "Nutrição", group: "HEALTH", valueWeight: 20 },
  { code: "8650003", label: "Psicologia e psicanálise", group: "HEALTH", valueWeight: 20 },
  { code: "8650004", label: "Fisioterapia", group: "HEALTH", valueWeight: 20 },

  // RETAIL
  { code: "4771701", label: "Farmácias (sem manipulação)", group: "RETAIL", valueWeight: 14 },
  { code: "4774100", label: "Óticas", group: "RETAIL", valueWeight: 14 },
  { code: "4781400", label: "Lojas de vestuário e acessórios", group: "RETAIL", valueWeight: 12 },
  { code: "4782201", label: "Lojas de calçados", group: "RETAIL", valueWeight: 12 },
  { code: "4754701", label: "Lojas de móveis", group: "RETAIL", valueWeight: 14 },
  { code: "4744005", label: "Materiais de construção em geral", group: "RETAIL", valueWeight: 12 },
  { code: "4744099", label: "Materiais de construção (especializado)", group: "RETAIL", valueWeight: 10 },
  { code: "4761003", label: "Papelarias", group: "RETAIL", valueWeight: 10 },
  { code: "4789002", label: "Floriculturas", group: "RETAIL", valueWeight: 12 },

  // SERVICES
  { code: "4520001", label: "Oficinas mecânicas", group: "SERVICES", valueWeight: 16 },
  { code: "4520005", label: "Lava-rápido", group: "SERVICES", valueWeight: 14 },
  { code: "6821801", label: "Imobiliárias (corretagem)", group: "SERVICES", valueWeight: 18 },
  { code: "8593700", label: "Escolas de idiomas", group: "SERVICES", valueWeight: 18 },
  { code: "6920601", label: "Escritórios de contabilidade", group: "SERVICES", valueWeight: 16 },
  { code: "5510801", label: "Hotéis e pousadas", group: "SERVICES", valueWeight: 18 },
];

export const CNAE_GROUPS: { value: CnaeGroup; label: string }[] = [
  { value: "FOOD", label: "Alimentação" },
  { value: "BEAUTY", label: "Beleza" },
  { value: "HEALTH", label: "Saúde" },
  { value: "FITNESS", label: "Fitness" },
  { value: "PET", label: "Pet" },
  { value: "RETAIL", label: "Comércio" },
  { value: "SERVICES", label: "Serviços" },
];

export function groupLabel(group: string): string {
  return CNAE_GROUPS.find((g) => g.value === group)?.label ?? group;
}
