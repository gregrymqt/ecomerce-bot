export type LogLevel = 'INFO' | 'SCRAPER' | 'AI_PROCESS' | 'SUCCESS' | 'LISTEN' | 'ERROR';

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

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'simulating' | 'completed' | 'error';
