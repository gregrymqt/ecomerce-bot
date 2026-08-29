/**
 * src/features/live-demo/services/liveDemoService.ts
 *
 * Camada de serviços HTTP e SSE para a demonstração em tempo real.
 * Utiliza o apiClient do projeto e a classe SSEClient para streaming de eventos.
 */

import { apiClient } from '@/lib/apiClient';
import { SSEClient } from '@/lib/sseClient';
import type { DemoStreamPayload, StreamCallbacks } from '../types';

export class LiveDemoService {
  private sseClient: SSEClient<DemoStreamPayload>;

  constructor() {
    this.sseClient = new SSEClient<DemoStreamPayload>();
  }

  /**
   * Dispara a requisição POST para o backend solicitando a extração da URL.
   * Endpoint primário: POST /api/v1/scraper/extract
   * Endpoint de compatibilidade: POST /api/v1/demo
   */
  public async requestDemoIngestion(urls: string[]): Promise<{ status: string; task_id?: string }> {
    const targetUrl = urls[0] || '';
    try {
      const response = await apiClient.post<{ status: string; task_id?: string }>(
        '/api/v1/scraper/extract',
        { url: targetUrl }
      );
      return response.data;
    } catch {
      // Fallback para rota legada se existir
      const response = await apiClient.post<{ status: string; task_id?: string }>(
        '/api/v1/demo',
        { urls }
      );
      return response.data;
    }
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
export default liveDemoService;
