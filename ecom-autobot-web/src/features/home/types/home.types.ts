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

export const MOCK_HOME_METRICS: HomeMetrics = {
  aiCreditsUsed: 3420,
  aiCreditsTotal: 5000,
  productsProcessedMonth: 1248,
  activeJobsCount: 3,
  successRate: 98.4,
};

export const MOCK_EXTRACTION_JOBS: ExtractionJob[] = [
  {
    id: 'job-101',
    productName: 'Fone de Ouvido Bluetooth Noise Cancelling 5.0',
    sourceDomain: 'amazon.com.br',
    aiModel: 'DeepSeek V3',
    status: 'Sucesso',
    createdAt: '2026-07-27T12:45:00Z',
  },
  {
    id: 'job-102',
    productName: 'Smartwatch Sport GPS Pro Water Resistant',
    sourceDomain: 'aliexpress.com',
    aiModel: 'Groq Llama 3',
    status: 'Processando',
    createdAt: '2026-07-27T13:10:00Z',
  },
  {
    id: 'job-103',
    productName: 'Teclado Mecânico RGB Wireless Dual Mode',
    sourceDomain: 'kabum.com.br',
    aiModel: 'OpenAI GPT-4o',
    status: 'Sucesso',
    createdAt: '2026-07-27T11:20:00Z',
  },
  {
    id: 'job-104',
    productName: 'Cadeira Ergonômica Pro Mesh 3D Black',
    sourceDomain: 'mercadolivre.com.br',
    aiModel: 'DeepSeek V3',
    status: 'Erro',
    createdAt: '2026-07-27T10:05:00Z',
  },
  {
    id: 'job-105',
    productName: 'Mouse Gamer 26000 DPI Sensor Óptico',
    sourceDomain: 'shopee.com.br',
    aiModel: 'Groq Llama 3',
    status: 'Sucesso',
    createdAt: '2026-07-27T09:30:00Z',
  },
];
