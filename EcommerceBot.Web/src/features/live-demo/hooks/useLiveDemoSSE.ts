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
  errorMessage: string | null;
  startExtraction: (url: string) => void;
  loadOfflinePreviewSample: () => void;
  resetDemo: () => void;
  clearLogs: () => void;
}

export function useLiveDemoSSE(): UseLiveDemoSSEReturn {
  const [status, setStatus] = useState<ConnectionStatus>('idle');
  const [logs, setLogs] = useState<DemoLogEvent[]>([]);
  const [progress, setProgress] = useState<number>(0);
  const [result, setResult] = useState<ScrapedProductResult | null>(null);
  const [targetUrl, setTargetUrl] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

  const addLog = useCallback((level: DemoLogEvent['level'], message: string, id?: string) => {
    setLogs((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.message === message && last.level === level) {
        const currentCount = last.count ?? 1;
        return [
          ...prev.slice(0, -1),
          {
            ...last,
            count: currentCount + 1,
            timestamp: new Date().toLocaleTimeString('pt-BR', { hour12: false }),
          },
        ];
      }

      if (id && prev.some((l) => l.id === id)) {
        return prev;
      }

      return [
        ...prev,
        {
          id: id || `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          timestamp: new Date().toLocaleTimeString('pt-BR', { hour12: false }),
          level,
          message,
          count: 1,
        },
      ];
    });
  }, []);

  const appendLogEvent = useCallback((incomingLog: DemoLogEvent) => {
    setLogs((prev) => {
      if (incomingLog.id && prev.some((l) => l.id === incomingLog.id)) {
        return prev;
      }
      const last = prev[prev.length - 1];
      if (last && last.message === incomingLog.message && last.level === incomingLog.level) {
        const currentCount = last.count ?? 1;
        return [
          ...prev.slice(0, -1),
          {
            ...last,
            count: currentCount + 1,
            timestamp: incomingLog.timestamp || last.timestamp,
          },
        ];
      }
      return [
        ...prev,
        {
          ...incomingLog,
          count: incomingLog.count ?? 1,
        },
      ];
    });
  }, []);

  const failDemoWithError = useCallback(
    (detail: string) => {
      cleanup();
      setProgress(0);
      setStatus('error');
      setErrorMessage(detail);
      setResult(null);
      addLog('ERROR', `Falha na extração em tempo real: ${detail}`);
    },
    [cleanup, addLog]
  );

  const loadOfflinePreviewSample = useCallback(() => {
    cleanup();
    setProgress(100);
    setStatus('fallback');
    addLog('INFO', 'Prévia de amostra offline carregada manualmente pelo usuário.');
    setResult({
      ...MOCK_DEMO_RESULT,
      isFallback: true,
      errorMessage: errorMessage ?? 'Modo de pré-visualização offline selecionado manualmente.',
    });
  }, [cleanup, addLog, errorMessage]);

  const handleSuccessResult = useCallback(
    (productResult: ScrapedProductResult) => {
      cleanup();
      setProgress(100);
      setStatus('completed');
      setErrorMessage(null);
      setResult({
        ...productResult,
        isFallback: false,
      });
    },
    [cleanup]
  );

  const startExtraction = useCallback(
    (url: string) => {
      cleanup();
      setTargetUrl(url);
      setResult(null);
      setErrorMessage(null);
      setStatus('connecting');
      setProgress(15);

      setLogs([
        {
          id: `log-init-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString('pt-BR', { hour12: false }),
          level: 'LISTEN',
          message: 'Iniciando extração e conectando ao stream SSE em /api/v1/system/demo/stream...',
        },
      ]);

      let isTerminated = false;

      // 1. Notifica o backend via POST /api/v1/system/demo
      liveDemoService.requestDemoIngestion([url]).catch((err) => {
        if (!isTerminated) {
          isTerminated = true;
          failDemoWithError(
            err instanceof Error ? err.message : 'Falha ao despachar tarefa para a fila de demonstração.'
          );
        }
      });

      // 2. Conecta ao stream SSE ignorando o ping inicial "connected" na detecção de timeout real
      let hasReceivedRealEvents = false;

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
            addLog('LISTEN', 'Conexão SSE em tempo real estabelecida com sucesso.');
          },
          onPayload: (payload: DemoStreamPayload) => {
            if (isTerminated) return;

            // Ignora evento inicial de handshake ("connected") para não neutralizar o timeout de 15s
            if (payload.type === 'connected') {
              return;
            }

            const isPipelineEvent =
              Boolean(payload.log) ||
              typeof payload.progress === 'number' ||
              Boolean(payload.result) ||
              payload.status === 'FAILED' ||
              payload.status === 'PROCESSED' ||
              Boolean(payload.isFallback);

            if (isPipelineEvent) {
              hasReceivedRealEvents = true;
            }

            if (payload.log) {
              appendLogEvent(payload.log);
            }
            if (typeof payload.progress === 'number') {
              setProgress(payload.progress);
            }
            if (payload.type === 'credits_refunded') {
              addLog('INFO', 'Estorno automático de 1 crédito processado no Ledger.');
            }
            if (payload.status === 'FAILED' || payload.isFallback) {
              isTerminated = true;
              failDemoWithError(payload.errorMessage || 'Falha de rede ou DNS no e-commerce de origem.');
            } else if (payload.status === 'PROCESSED' && payload.result) {
              isTerminated = true;
              handleSuccessResult(payload.result);
            }
          },
          onError: () => {
            if (!isTerminated && !hasReceivedRealEvents) {
              isTerminated = true;
              failDemoWithError('Não foi possível conectar ao servidor de eventos em tempo real (SSE).');
            }
          },
        });

        // Timeout resiliente de 15 segundos para resposta real do Worker RabbitMQ
        connectionTimeoutRef.current = setTimeout(() => {
          if (!isTerminated && !hasReceivedRealEvents) {
            isTerminated = true;
            failDemoWithError('Tempo limite de processamento na fila RabbitMQ excedido (15s).');
          }
        }, 15000);
      } catch (err) {
        isTerminated = true;
        failDemoWithError(err instanceof Error ? err.message : 'Falha inesperada ao iniciar conexão SSE.');
      }
    },
    [cleanup, addLog, appendLogEvent, failDemoWithError, handleSuccessResult]
  );

  const resetDemo = useCallback(() => {
    cleanup();
    setStatus('idle');
    setLogs([]);
    setProgress(0);
    setResult(null);
    setTargetUrl('');
    setErrorMessage(null);
  }, [cleanup]);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

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
    errorMessage,
    startExtraction,
    loadOfflinePreviewSample,
    resetDemo,
    clearLogs,
  };
}

export default useLiveDemoSSE;
