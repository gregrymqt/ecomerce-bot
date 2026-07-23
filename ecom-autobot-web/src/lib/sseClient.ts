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

// src/lib/sseClient.ts

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

export class SSEClient<T = any> {
  private eventSource: EventSource | null = null;
  private baseUrl: string;

  constructor() {
    this.baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
  }

  /**
   * Abre a conexão SSE com o backend.
   */
  public connect({ endpoint, onMessage, onError, onOpen }: SSEClientOptions<T>): void {
    // Garante que conexões anteriores sejam fechadas antes de abrir uma nova
    this.close();

    const url = `${this.baseUrl}${endpoint}`;

    // 💡 OBRIGATÓRIO: { withCredentials: true } envia os cookies HttpOnly na conexão SSE
    this.eventSource = new EventSource(url, { withCredentials: true });

    if (onOpen) {
      this.eventSource.onopen = () => onOpen();
    }

    this.eventSource.onmessage = (event: MessageEvent) => {
      try {
        // Tenta converter o dado de texto do Redis para objeto JSON
        const parsedData: T = JSON.parse(event.data);
        onMessage(parsedData);
      } catch {
        // Fallback caso a mensagem do Redis venha em texto puro
        onMessage(event.data as unknown as T);
      }
    };

    this.eventSource.onerror = (error: Event) => {
      if (onError) {
        onError(error);
      }
    };
  }

  /**
   * Encerra a conexão SSE e limpa os recursos.
   */
  public close(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }
}