import { getTenantId, getAuthToken } from '@/utils/storage';
import { env } from '@/config/env';

export interface SSEClientOptions<T> {
  /** Caminho relativo da rota (ex: '/demo/stream') */
  endpoint: string;
  /** Callback para cada mensagem recebida do servidor */
  onMessage: (data: T) => void;
  /** Callback de erro ou desconexão */
  onError?: (error: unknown) => void;
  /** Callback para quando a conexão abrir com sucesso */
  onOpen?: () => void;
}

export class SSEClient<T = unknown> {
  private abortController: AbortController | null = null;
  private baseUrl: string;

  constructor() {
    this.baseUrl = env.apiUrl;
  }

  /**
   * Abre a conexão SSE resiliente via Fetch + ReadableStream, permitindo cabeçalhos customizados
   * (ngrok-skip-browser-warning, X-Tenant-ID, Authorization) imunes a bloqueios de túnel e CORS.
   */
  public connect({ endpoint, onMessage, onError, onOpen }: SSEClientOptions<T>): void {
    this.close();

    this.abortController = new AbortController();
    const { signal } = this.abortController;

    const tenantId = getTenantId();
    const authToken = getAuthToken();
    const hasQuery = endpoint.includes('?');
    const queryParams: string[] = [];

    if (tenantId) {
      queryParams.push(`tenant_id=${encodeURIComponent(tenantId)}`);
    }
    queryParams.push('ngrok-skip-browser-warning=true');

    const connector = hasQuery ? '&' : '?';
    const url = `${this.baseUrl}${endpoint}${connector}${queryParams.join('&')}`;

    console.info(`[SSEClient] Iniciando conexão SSE via Fetch Stream em: ${url}`);

    const headers: Record<string, string> = {
      Accept: 'text/event-stream',
      'ngrok-skip-browser-warning': 'true',
    };

    if (tenantId) {
      headers['X-Tenant-ID'] = tenantId;
    }
    if (authToken) {
      headers.Authorization = `Bearer ${authToken}`;
    }

    (async () => {
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers,
          credentials: 'include',
          signal,
        });

        if (!response.ok || !response.body) {
          throw new Error(`Falha na resposta HTTP do stream SSE: Status ${response.status}`);
        }

        console.info('[SSEClient] Conexão SSE estabelecida com sucesso (HTTP 200 text/event-stream).');
        if (onOpen) {
          onOpen();
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const rawLine of lines) {
            const line = rawLine.trim();
            if (line.startsWith('data: ')) {
              const dataStr = line.slice(6).trim();
              if (dataStr) {
                try {
                  const parsedData: T = JSON.parse(dataStr);
                  console.debug('[SSEClient] Mensagem SSE recebida:', parsedData);
                  onMessage(parsedData);
                } catch {
                  onMessage(dataStr as T);
                }
              }
            }
          }
        }
      } catch (err: unknown) {
        if (signal.aborted) {
          return;
        }
        console.warn('[SSEClient] Erro na conexão SSE:', err);
        if (onError) {
          onError(err);
        }
      }
    })();
  }

  public close(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }
}