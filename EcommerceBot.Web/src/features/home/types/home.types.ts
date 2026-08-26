export type AIModel = 'DeepSeek V3' | 'Groq Llama 3' | 'OpenAI GPT-4o';

export type JobStatus = 'Sucesso' | 'Processando' | 'Erro';

export interface ExtractionJob {
  id: string;
  productName: string;
  sourceDomain: string;
  aiModel: AIModel;
  status: JobStatus;
  createdAt: string;
}

export interface HomeMetrics {
  aiCreditsUsed: number;
  aiCreditsTotal: number;
  productsProcessedMonth: number;
  activeJobsCount: number;
  successRate: number;
}

export interface HomeMetrics {
  aiCreditsUsed: number;
  aiCreditsTotal: number;
  productsProcessedMonth: number;
  activeJobsCount: number;
  successRate: number;
}

