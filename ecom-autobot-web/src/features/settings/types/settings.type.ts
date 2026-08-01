/**
 * src/features/settings/types/settings.type.ts
 *
 * Contratos de tipos e DTOs para a feature de Configurações do Tenant.
 * Alinhado estritamente com a arquitetura DDD e os Schemas da API FastAPI (ecom-autobot-api).
 */

/**
 * Abas ativas no painel de configurações.
 */
export type SettingsTab = 'AI_RULES' | 'STORE_PROFILE' | 'BILLING_DATA';

/**
 * Tons de voz suportados pela IA durante a geração de copywriting magnético.
 */
export type ToneOfVoice = 'PERSUASIVE' | 'TECHNICAL' | 'DIRECT' | 'CASUAL';

/**
 * Regras de arredondamento de preços aplicadas aos produtos extraídos.
 */
export type RoundingRule = 'ENDING_99' | 'ENDING_90' | 'NEAREST_INTEGER' | 'NONE';

/**
 * Idioma padrão para geração de metadados e conteúdos de SEO.
 */
export type DefaultLanguage = 'PT_BR' | 'EN_US' | 'ES';

/**
 * DTO para atualização das regras de inteligência artificial e preços.
 */
export interface AiSettingsPayload {
  /** Idioma principal dos produtos gerados */
  default_language: DefaultLanguage;
  /** Lista de tags de SEO padrão aplicadas em novos produtos */
  seo_tags: string[];
  /** Tom de voz utilizado pela LLM no copywriting */
  tone_of_voice: ToneOfVoice;
  /** Percentual de markup aplicado sobre o preço original (ex: 20 para +20%) */
  price_markup_percentage: number;
  /** Regra de arredondamento de preço final */
  rounding_rule: RoundingRule;
}

/**
 * DTO de perfil de loja e dados cadastrais do tenant.
 */
export interface StoreProfilePayload {
  /** Nome amigável da loja de e-commerce */
  store_name: string;
  /** Identificador único do tenant no sistema */
  tenant_id: string;
  /** E-mail do administrador do tenant */
  admin_email: string;
  /** Fuso horário da loja (ex: "America/Sao_Paulo") */
  timezone: string;
  /** Moeda base para transações e exibição (ex: "BRL", "USD") */
  base_currency: string;
}

/**
 * DTO de dados de faturamento e suporte fiscal do tenant.
 */
export interface BillingProfilePayload {
  /** Razão Social ou Nome Fantasia da empresa */
  company_name: string;
  /** CNPJ ou CPF para emissão de nota fiscal */
  tax_id: string;
  /** E-mail responsável por receber faturas e recibos */
  billing_email: string;
  /** Endereço comercial completo */
  commercial_address: string;
}

/**
 * Resposta consolidada contendo todas as configurações do tenant ativas.
 */
export interface TenantSettingsResponse {
  /** Configurações de IA, SEO e Arredondamento */
  ai: AiSettingsPayload;
  /** Perfil da Loja e Tenant */
  profile: StoreProfilePayload;
  /** Dados de Faturamento e Nota Fiscal */
  billing: BillingProfilePayload;
}
