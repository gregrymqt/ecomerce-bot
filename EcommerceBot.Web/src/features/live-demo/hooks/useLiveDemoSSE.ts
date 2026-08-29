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

  // Simulação progressiva de extração caso o backend SSE esteja em modo desconectado
  const runSimulatedFallback = useCallback((url: string) => {
    setStatus('simulating');
    let step = 0;
    const steps: { progress: number; log: DemoLogEvent }[] = [
      {
        progress: 25,
        log: {
          id: `sim-log-1-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString('pt-BR', { hour12: false }),
          level: 'SCRAPER',
          message: `Iniciando Scrapling headless browser para ${new URL(url).hostname}...`,
        },
      },
      {
        progress: 50,
        log: {
          id: `sim-log-2-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString('pt-BR', { hour12: false }),
          level: 'INFO',
          message: 'Extraindo schema JSON-LD, tags OpenGraph e galeria de imagens.',
        },
      },
      {
        progress: 75,
        log: {
          id: `sim-log-3-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString('pt-BR', { hour12: false }),
          level: 'AI_PROCESS',
          message: 'Enviando contexto para OpenRouter LLM (DeepSeek V3 / Groq Llama 3)...',
        },
      },
      {
        progress: 90,
        log: {
          id: `sim-log-4-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString('pt-BR', { hour12: false }),
          level: 'AI_PROCESS',
          message: 'Gerando título magnético, SEO score e bullet points de alta conversão.',
        },
      },
      {
        progress: 100,
        log: {
          id: `sim-log-5-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString('pt-BR', { hour12: false }),
          level: 'SUCCESS',
          message: 'Catálogo enriquecido com sucesso! Resultado pronto para publicação.',
        },
      },
    ];

    simulationIntervalRef.current = setInterval(() => {
      if (step < steps.length) {
        const currentStep = steps[step];
        setProgress(currentStep.progress);
        setLogs((prev) => [...prev, currentStep.log]);
        step += 1;
      } else {
        if (simulationIntervalRef.current) {
          clearInterval(simulationIntervalRef.current);
          simulationIntervalRef.current = null;
        }
        setResult(MOCK_DEMO_RESULT);
        setStatus('completed');
      }
    }, 700);
  }, []);

  const handleConnectionError = useCallback((url: string) => {
    cleanup();
    // Executa fallback simulado para garantir a experiência da demo
    runSimulatedFallback(url);
  }, [cleanup, runSimulatedFallback]);

  const startExtraction = useCallback(
    (url: string) => {
      cleanup();
      setTargetUrl(url);
      setLogs([
        {
          id: `log-init-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString('pt-BR', { hour12: false }),
          level: 'LISTEN',
          message: 'Iniciando extração e conectando ao stream SSE em /api/v1/demo/stream...',
        },
      ]);
      setResult(null);
      setStatus('connecting');
      setProgress(10);

      // 1. Notifica o backend via POST /api/v1/scraper/extract
      liveDemoService.requestDemoIngestion([url]).catch(() => {
        // Erros capturados no próprio fluxo
      });

      // 2. Conecta ao stream SSE
      try {
        let hasReceivedEvents = false;

        liveDemoService.connectStream(url, {
          onOpen: () => {
            if (connectionTimeoutRef.current) {
              clearTimeout(connectionTimeoutRef.current);
              connectionTimeoutRef.current = null;
            }
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
            setResult(res);
            setStatus('completed');
            cleanup();
          },
          onError: () => {
            if (!hasReceivedEvents) {
              handleConnectionError(url);
            }
          },
        });

        // Timeout de 4s para transicionar para simulação caso o backend SSE não envie eventos
        connectionTimeoutRef.current = setTimeout(() => {
          if (!hasReceivedEvents) {
            handleConnectionError(url);
          }
        }, 4000);
      } catch {
        handleConnectionError(url);
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

export default useLiveDemoSSE;
