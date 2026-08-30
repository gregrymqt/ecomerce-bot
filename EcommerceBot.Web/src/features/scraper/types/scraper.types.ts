/**
 * src/features/scraper/types/scraper.types.ts
 *
 * Contratos de tipos e DTOs canônicos para a feature Scraper (Extração e Enriquecimento Web).
 * Alinhado estritamente com os padrões de arquitetura em 4 camadas e WCAG 2.1 AA.
 */

export interface WebScraperRequest {
  url: string;
  tenant_id?: string;
}

export interface WebScraperResponse {
  status: 'accepted' | string;
  task_id: string;
  message: string;
}

export interface ScrapedProductResult {
  title?: string | null;
  description?: string | null;
  price?: string | null;
  currency?: string | null;
  image_url?: string | null;
  sku?: string | null;
}

export interface ScraperStreamEvent {
  url?: string;
  status: 'scraping' | 'generating' | 'completed' | 'failed';
  progress: number;
  error?: string;
  original?: {
    title: string;
    description: string;
    price?: string | null;
    imageUrl?: string | null;
  };
  enhanced?: {
    seoTitle: string;
    copywriting: string;
    tags: string[];
  };
}

export interface BatchQueueItem {
  id: number;
  url: string;
  status: 'pending' | 'sending' | 'completed' | 'failed';
  error?: string;
}

export interface UseScraperReturn {
  url: string;
  setUrl: (url: string) => void;
  isLoading: boolean;
  error: string | null;
  taskId: string | null;
  submitUrl: () => Promise<void>;
  reset: () => void;
}

export interface UseScraperStreamReturn {
  events: ScraperStreamEvent[];
  progress: number;
  isStreaming: boolean;
  error: string | null;
  lastEvent: ScraperStreamEvent | null;
  connect: () => void;
  disconnect: () => void;
}

export interface ScraperFormProps {
  className?: string;
}

export interface ScraperStreamTerminalProps {
  events: ScraperStreamEvent[];
  progress: number;
  isStreaming: boolean;
  error: string | null;
  onDisconnect: () => void;
  onReset: () => void;
  className?: string;
}
