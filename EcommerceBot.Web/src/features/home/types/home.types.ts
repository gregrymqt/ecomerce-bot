/**
 * src/features/home/types/home.types.ts
 *
 * Contratos de tipos e DTOs canônicos para a feature Home / Dashboard Overview.
 * Alinhado estritamente com os padrões de arquitetura em 4 camadas e WCAG 2.1 AA.
 */

export type AIModel =
  | 'DeepSeek V3'
  | 'Groq Llama 3'
  | 'OpenAI GPT-4o'
  | 'Gemini 1.5 Pro'
  | 'Claude 3.5 Sonnet';

export type JobStatus = 'Sucesso' | 'Processando' | 'Erro';

export interface ExtractionJob {
  id: string;
  sku?: string;
  productName: string;
  sourceDomain: string;
  aiModel: AIModel;
  status: JobStatus;
  createdAt: string;
  productUrl?: string;
}

export interface HomeMetrics {
  aiCreditsUsed: number;
  aiCreditsTotal: number;
  productsProcessedMonth: number;
  activeJobsCount: number;
  successRate: number;
}

export interface HomeIntegrationsSummary {
  connectedCount: number;
  totalIntegrations: number;
  hasShopify: boolean;
  hasNuvemshop: boolean;
  hasMercadoPago: boolean;
  hasByokKeys: boolean;
}

export interface HomeOverviewData {
  metrics: HomeMetrics;
  jobs: ExtractionJob[];
  integrations: HomeIntegrationsSummary;
}
