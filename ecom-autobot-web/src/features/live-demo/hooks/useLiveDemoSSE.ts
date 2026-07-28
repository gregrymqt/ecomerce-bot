import { useState, useRef, useEffect, useCallback } from 'react';
import type {
  ConnectionStatus,
  DemoLogEvent,
  ScrapedProductResult,
} from '../types/live-demo.types';
import {
  MOCK_SSE_LOGS,
  MOCK_PRODUCT_RESULT,
} from '../constants/mock-demo-data';
import { liveDemoService } from '../services/liveDemoService';

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
  const simulationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cleanup = useCallback(() => {
    liveDemoService.disconnectStream();

    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = null;
    }
    if (simulationIntervalRef.current) {
      clearInterval(simulationIntervalRef.current);
      simulationIntervalRef.current = null;
    }
  }, []);

  const runSimulation = useCallback(() => {
    cleanup();
    setStatus('simulating');
    setLogs([]);
    setProgress(10);
    setResult(null);

    let currentIndex = 0;
    const totalLogs = MOCK_SSE_LOGS.length;

    simulationIntervalRef.current = setInterval(() => {
      if (currentIndex < totalLogs) {
        const nextLog = MOCK_SSE_LOGS[currentIndex];
        setLogs((prev) => [...prev, nextLog]);

        const calculatedProgress = Math.min(
          100,
          Math.round(((currentIndex + 1) / totalLogs) * 100)
        );
        setProgress(calculatedProgress);

        currentIndex++;

        if (currentIndex === totalLogs) {
          if (simulationIntervalRef.current) {
            clearInterval(simulationIntervalRef.current);
            simulationIntervalRef.current = null;
          }
          setResult(MOCK_PRODUCT_RESULT);
          setStatus('completed');
          setProgress(100);
        }
      }
    }, 700);
  }, [cleanup]);

  const startExtraction = useCallback(
    (url: string) => {
      cleanup();
      setTargetUrl(url);
      setLogs([]);
      setResult(null);
      setStatus('connecting');
      setProgress(10);

      // 1. Notifica o backend via POST /api/v1/demo para enfileirar o job de extração
      liveDemoService.requestDemoIngestion([url]).catch(() => {
        // Erros no POST não crasham o fluxo de stream/fallback
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
            runSimulation();
          },
        });

        // Timeout de 3s se a conexão SSE do servidor não responder a tempo
        connectionTimeoutRef.current = setTimeout(() => {
          runSimulation();
        }, 3000);
      } catch {
        runSimulation();
      }
    },
    [cleanup, runSimulation]
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
