// src/lib/sseClient.ts
import { getTenantId } from '@/utils/storage';

export interface SSEClientOptions<T> {
  /** Caminho relativo da rota (ex: '/demo/stream') */
  endpoint: string;
  /** Callback para cada mensagem recebida do servidor */
  onMessage: (data: T) => void;
  /** Callback de erro ou desconexão */
  onError?: (error: Event) => void;
  /** Callback para quando a conexão abrir com sucesso */
  onOpen?: () => void;
}

export class SSEClient<T = unknown> {
  private eventSource: EventSource | null = null;
  private baseUrl: string;

  constructor() {
    this.baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
  }

  /**
   * Abre a conexão SSE com o backend incluindo o tenant ativo na query URL.
   */
  public connect({ endpoint, onMessage, onError, onOpen }: SSEClientOptions<T>): void {
    this.close();

    const tenantId = getTenantId();
    const separator = endpoint.includes('?') ? '&' : '?';
    const tenantParam = tenantId ? `${separator}tenant_id=${encodeURIComponent(tenantId)}` : '';
    
    const url = `${this.baseUrl}${endpoint}${tenantParam}`;

    // { withCredentials: true } envia os cookies HttpOnly na conexão SSE
    this.eventSource = new EventSource(url, { withCredentials: true });

    if (onOpen) {
      this.eventSource.onopen = () => onOpen();
    }

    this.eventSource.onmessage = (event: MessageEvent) => {
      try {
        const parsedData: T = JSON.parse(event.data);
        onMessage(parsedData);
      } catch {
        onMessage(event.data as T);
      }
    };

    this.eventSource.onerror = (error: Event) => {
      if (onError) {
        onError(error);
      }
    };
  }

  public close(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }
}