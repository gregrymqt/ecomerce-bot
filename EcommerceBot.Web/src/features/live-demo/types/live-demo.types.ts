/**
 * src/features/live-demo/types/live-demo.types.ts
 *
 * Contratos de tipos e DTOs canônicos para a feature Live Demo / Demonstração em Tempo Real.
 * Alinhado estritamente com os padrões de arquitetura em 4 camadas e WCAG 2.1 AA.
 */

export type LogLevel =
  | 'INFO'
  | 'SCRAPER'
  | 'AI_PROCESS'
  | 'SUCCESS'
  | 'LISTEN'
  | 'ERROR';

export interface DemoLogEvent {
  id: string;
  timestamp: string;
  level: LogLevel;
  message: string;
}

export interface ScrapedProductResult {
  titleOriginal: string;
  titleMagnetic: string;
  tone: string;
  category: string;
  seoScore: number;
  bulletPoints: string[];
  price: string;
  imageUrl: string;
  rawJson: Record<string, unknown>;
}

export type ConnectionStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'simulating'
  | 'completed'
  | 'error';

export interface SampleUrlItem {
  label: string;
  url: string;
  platform: 'Shopify' | 'Nuvemshop' | 'Mercado Livre';
}

export interface DemoStreamPayload {
  log?: DemoLogEvent;
  progress?: number;
  result?: ScrapedProductResult;
}

export interface StreamCallbacks {
  onOpen?: () => void;
  onLog?: (log: DemoLogEvent) => void;
  onProgress?: (progress: number) => void;
  onResult?: (result: ScrapedProductResult) => void;
  onError?: (error: Event) => void;
}
