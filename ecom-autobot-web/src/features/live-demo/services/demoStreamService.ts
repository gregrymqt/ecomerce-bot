// src/features/live-demo/services/demoStreamService.ts
import { apiClient } from '@/lib/apiClient';
import { SSEClient } from '@/lib/sseClient';

export interface DemoProgressPayload<TData = Record<string, unknown>> {
  step: string;
  message: string;
  progress: number;
  data?: TData;
}

export class DemoStreamService {
  private sseClient = new SSEClient<DemoProgressPayload>();

  /**
   * Dispara a requisição POST para a rota /demo enviando as URLs.
   */
  async requestDemo(urls: string[]) {
    const response = await apiClient.post('/demo', { urls });
    return response.data; // { status: "enviado_para_fila" }
  }

  /**
   * Conecta ao endpoint /demo/stream do FastAPI e escuta o canal do Redis.
   */
  subscribeToDemoStream(
    onProgress: (data: DemoProgressPayload) => void,
    onError?: (err: Event) => void
  ) {
    this.sseClient.connect({
      endpoint: '/demo/stream',
      onMessage: (data) => onProgress(data),
      onError: (err) => {
        console.error('Erro na conexão SSE:', err);
        if (onError) onError(err);
      },
    });
  }

  /**
   * Cancela a escuta da stream.
   */
  unsubscribe() {
    this.sseClient.close();
  }
}

export const demoStreamService = new DemoStreamService();