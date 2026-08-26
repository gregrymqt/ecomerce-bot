/**
 * DTO para solicitar a extração de URL via Web Scraping.
 * Corresponde ao WebScraperRequest do Pydantic no backend.
 */
export interface WebScraperRequest {
  url: string;
  tenant_id?: string;
}

/**
 * Resposta de aceite do job assíncrono (HTTP 202).
 */
export interface WebScraperResponse {
  status: 'accepted' | string;
  task_id: string;
  message: string;
}

/**
 * Estrutura de dados extraídos do produto (ScrapedProductResult).
 */
export interface ScrapedProductResult {
  title?: string | null;
  description?: string | null;
  price?: string | null;
  currency?: string | null;
  image_url?: string | null;
  sku?: string | null;
}

/**
 * Evento do Redis/PubSub recebido via SSE (/api/v1/demo/stream).
 */
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

/**
 * Return type do hook useScraper.
 */
export interface UseScraperReturn {
  url: string;
  setUrl: (url: string) => void;
  isLoading: boolean;
  error: string | null;
  taskId: string | null;
  submitUrl: () => Promise<void>;
  reset: () => void;
}

/**
 * Return type do hook useScraperStream.
 */
export interface UseScraperStreamReturn {
  events: ScraperStreamEvent[];
  progress: number;
  isStreaming: boolean;
  error: string | null;
  lastEvent: ScraperStreamEvent | null;
  connect: () => void;
  disconnect: () => void;
}

/**
 * Props do componente ScraperForm.
 */
export interface ScraperFormProps {
  className?: string;
}

/**
 * Props do componente ScraperStreamTerminal.
 */
export interface ScraperStreamTerminalProps {
  events: ScraperStreamEvent[];
  progress: number;
  isStreaming: boolean;
  error: string | null;
  onDisconnect: () => void;
  onReset: () => void;
  className?: string;
}