import { useState, useRef, useEffect, useCallback } from 'react';
import type {
  ConnectionStatus,
  DemoLogEvent,
  ScrapedProductResult,
} from '@/features/live-demo';
import { liveDemoService } from '@/features/live-demo';

export interface UseLiveDemoSSEReturn {
  status: ConnectionStatus;
  logs: DemoLogEvent[];
  progress: number;
  result: ScrapedProductResult | null;
  targetUrl: string;
  startExtraction: (url: string) => void;
  resetDemo: () => void;
}

export function useLiveDemoSSE(): UseLiveDemoSSEReturn {
  const [status, setStatus] = useState<ConnectionStatus>('idle');
  const [logs, setLogs] = useState<DemoLogEvent[]>([]);
  const [progress, setProgress] = useState<number>(0);
  const [result, setResult] = useState<ScrapedProductResult | null>(null);
  const [targetUrl, setTargetUrl] = useState<string>('');

  const connectionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cleanup = useCallback(() => {
    liveDemoService.disconnectStream();

    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = null;
    }
  }, []);

  const handleConnectionError = useCallback((msg = 'Falha ao conectar ao servidor SSE de transmissão em tempo real.') => {
    cleanup();
    setStatus('error');
    setLogs((prev) => [
      ...prev,
      {
        id: `err-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour12: false }),
        level: 'ERROR',
        message: msg,
      },
    ]);
  }, [cleanup]);

  const startExtraction = useCallback(
    (url: string) => {
      cleanup();
      setTargetUrl(url);
      setLogs([
        {
          id: `log-init-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString('pt-BR', { hour12: false }),
          level: 'LISTEN',
          message: `Iniciando extração e conectando ao stream SSE em /api/v1/demo/stream...`,
        },
      ]);
      setResult(null);
      setStatus('connecting');
      setProgress(10);

      // 1. Notifica o backend via POST /api/v1/demo para enfileirar o job de extração
      liveDemoService.requestDemoIngestion([url]).catch(() => {
        // Erros na rota POST serão percebidos no próprio SSE ou timeout
      });

      // 2. Conecta ao stream SSE utilizando liveDemoService (que consome SSEClient)
      try {
        liveDemoService.connectStream(url, {
          onOpen: () => {
            if (connectionTimeoutRef.current) {
              clearTimeout(connectionTimeoutRef.current);
              connectionTimeoutRef.current = null;
            }
            setStatus('connected');
          },
          onLog: (log) => {
            setLogs((prev) => [...prev, log]);
          },
          onProgress: (prog) => {
            setProgress(prog);
          },
          onResult: (res) => {
            setResult(res);
            setStatus('completed');
            cleanup();
          },
          onError: () => {
            handleConnectionError('Erro na conexão com o stream SSE.');
          },
        });

        // Timeout de 10s se o servidor SSE não responder
        connectionTimeoutRef.current = setTimeout(() => {
          handleConnectionError('Timeout: Servidor SSE não respondeu a tempo.');
        }, 10000);
      } catch {
        handleConnectionError('Erro ao iniciar a conexão SSE.');
      }
    },
    [cleanup, handleConnectionError]
  );

  const resetDemo = useCallback(() => {
    cleanup();
    setStatus('idle');
    setLogs([]);
    setProgress(0);
    setResult(null);
    setTargetUrl('');
  }, [cleanup]);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    status,
    logs,
    progress,
    result,
    targetUrl,
    startExtraction,
    resetDemo,
  };
}
