import { apiClient } from '@/lib/apiClient';
import { SSEClient } from '@/lib/sseClient';
import type { DemoLogEvent, ScrapedProductResult } from '../types/live-demo.types';

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

export class LiveDemoService {
  private sseClient: SSEClient<DemoStreamPayload>;

  constructor() {
    this.sseClient = new SSEClient<DemoStreamPayload>();
  }

  /**
   * Dispara a requisição POST para o backend solicitando a ingestão da demo.
   */
  public async requestDemoIngestion(urls: string[]): Promise<{ status: string }> {
    const response = await apiClient.post<{ status: string }>('/api/v1/demo', { urls });
    return response.data;
  }

  /**
   * Conecta ao endpoint Server-Sent Events (SSE) `/api/v1/demo/stream` utilizando a instância de SSEClient.
   */
  public connectStream(targetUrl: string, callbacks: StreamCallbacks): void {
    const endpoint = `/api/v1/demo/stream?url=${encodeURIComponent(targetUrl)}`;

    this.sseClient.connect({
      endpoint,
      onOpen: callbacks.onOpen,
      onMessage: (data: DemoStreamPayload) => {
        if (data.log && callbacks.onLog) {
          callbacks.onLog(data.log);
        }
        if (typeof data.progress === 'number' && callbacks.onProgress) {
          callbacks.onProgress(data.progress);
        }
        if (data.result && callbacks.onResult) {
          callbacks.onResult(data.result);
        }
      },
      onError: callbacks.onError,
    });
  }

  /**
   * Desconecta o stream SSE ativo através da instância de SSEClient.
   */
  public disconnectStream(): void {
    this.sseClient.close();
  }
}

export const liveDemoService = new LiveDemoService();
