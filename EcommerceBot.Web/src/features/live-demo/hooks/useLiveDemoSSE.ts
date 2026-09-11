/**
 * src/features/live-demo/hooks/useLiveDemoSSE.ts
 *
 * Hook principal para orquestração da transmissão SSE em tempo real.
 * Conecta via liveDemoService e provê fallback progressivo com simulação fluida.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import type {
  ConnectionStatus,
  DemoLogEvent,
  DemoStreamPayload,
  ScrapedProductResult,
} from '../types';
import { liveDemoService } from '../services/liveDemoService';
import { MOCK_DEMO_RESULT } from '../constants/mock-demo-data';

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
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cleanup = useCallback(() => {
    liveDemoService.disconnectStream();

    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = null;
    }
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
  }, []);

  const addLog = useCallback((level: DemoLogEvent['level'], message: string) => {
    setLogs((prev) => [
      ...prev,
      {
        id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour12: false }),
        level,
        message,
      },
    ]);
  }, []);

  const activateFallback = useCallback(
    (errorMessage: string) => {
      cleanup();
      setProgress(100);
      setStatus('fallback');
      addLog('ERROR', `Falha na extração em tempo real: ${errorMessage}`);
      addLog('INFO', 'Ativando modo de demonstração com dados de amostra para pré-visualização.');

      setResult({
        ...MOCK_DEMO_RESULT,
        isFallback: true,
        errorMessage,
      });
    },
    [cleanup, addLog]
  );

  const handleSuccessResult = useCallback(
    (productResult: ScrapedProductResult) => {
      cleanup();
      setProgress(100);
      setStatus('completed');
      addLog('SUCCESS', 'Catálogo enriquecido com sucesso! Resultado pronto para publicação.');
      setResult({
        ...productResult,
        isFallback: false,
      });
    },
    [cleanup, addLog]
  );

  const startExtraction = useCallback(
    (url: string) => {
      cleanup();
      setTargetUrl(url);
      setResult(null);
      setStatus('connecting');
      setProgress(15);

      setLogs([
        {
          id: `log-init-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString('pt-BR', { hour12: false }),
          level: 'LISTEN',
          message: 'Iniciando extração e conectando ao stream SSE em /api/v1/demo/stream...',
        },
      ]);

      // 1. Notifica o backend via POST /api/v1/scraper/extract
      liveDemoService.requestDemoIngestion([url]).catch((err) => {
        addLog('ERROR', `Erro ao despachar tarefa: ${err instanceof Error ? err.message : 'Falha na requisição'}`);
      });

      // 2. Conecta ao stream SSE
      let hasReceivedEvents = false;

      // Telemetria intermediária: evita terminal congelado enquanto o worker processa o job
      let stepCount = 0;
      progressTimerRef.current = setInterval(() => {
        stepCount += 1;
        if (stepCount === 1) {
          setProgress(40);
          addLog('SCRAPER', 'Orquestrando Scrapling / Coletando metadados e JSON-LD da loja...');
        } else if (stepCount === 2) {
          setProgress(70);
          addLog('AI_PROCESS', 'Enviando contexto para modelo LLM / Gerando título magnético e SEO...');
        } else if (stepCount === 3) {
          setProgress(85);
        }
      }, 2000);

      try {
        liveDemoService.connectStream(url, {
          onOpen: () => {
            setStatus('connected');
          },
          onLog: (log) => {
            hasReceivedEvents = true;
            setLogs((prev) => [...prev, log]);
          },
          onProgress: (prog) => {
            hasReceivedEvents = true;
            setProgress(prog);
          },
          onResult: (res) => {
            hasReceivedEvents = true;
            if (res.isFallback) {
              activateFallback(res.errorMessage || 'Falha na extração de produto');
            } else {
              handleSuccessResult(res);
            }
          },
          onPayload: (payload: DemoStreamPayload) => {
            hasReceivedEvents = true;
            if (payload.status === 'FAILED' || payload.isFallback) {
              activateFallback(payload.errorMessage || 'Falha de rede ou DNS no e-commerce de origem.');
            } else if (payload.status === 'PROCESSED' && payload.result) {
              handleSuccessResult(payload.result);
            }
          },
          onError: () => {
            if (!hasReceivedEvents) {
              activateFallback('Não foi possível conectar ao servidor de eventos em tempo real (SSE).');
            }
          },
        });

        // Timeout resiliente de 15 segundos para resposta do Worker RabbitMQ
        connectionTimeoutRef.current = setTimeout(() => {
          if (!hasReceivedEvents) {
            activateFallback('Tempo limite de processamento na fila RabbitMQ excedido.');
          }
        }, 15000);
      } catch (err) {
        activateFallback(err instanceof Error ? err.message : 'Falha inesperada ao iniciar conexão SSE.');
      }
    },
    [cleanup, addLog, activateFallback, handleSuccessResult]
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

export default useLiveDemoSSE;
