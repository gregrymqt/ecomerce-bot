import { apiClient } from '@/lib/apiClient';
import { SSEClient } from '@/lib/sseClient';
import type { DemoProgressPayload, DemoResponsePayload } from '..';

export class DemoStreamService {
  private sseClient = new SSEClient<DemoProgressPayload>();

  /**
   * Dispara a requisição POST para a rota /demo enviando as URLs.
   */
  async requestDemo(urls: string[]): Promise<DemoResponsePayload> {
    const response = await apiClient.post<DemoResponsePayload>('/demo', { urls });
    return response.data;
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