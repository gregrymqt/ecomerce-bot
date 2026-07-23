// src/features/live-demo/hooks/useDemoStream.ts
import { useState, useEffect, useCallback } from 'react';
import { demoStreamService, type DemoProgressPayload } from '../services/demoStreamService';

export interface UseDemoStreamReturn {
  /** Histórico de todos os logs/mensagens recebidos via SSE */
  logs: DemoProgressPayload[];
  /** Porcentagem de progresso de 0 a 100 */
  progress: number;
  /** Indica se a transmissão está ativa e aguardando/processando */
  isStreaming: boolean;
  /** Mensagem de erro caso o POST ou o SSE falhem */
  error: string | null;
  /** Dispara o processo enviando as URLs para o backend */
  startDemo: (urls: string[]) => Promise<void>;
  /** Cancela manualmente a transmissão atual */
  stopDemo: () => void;
  /** Limpa o histórico de logs e reseta o estado */
  resetDemo: () => void;
}

export const useDemoStream = (): UseDemoStreamReturn => {
  const [logs, setLogs] = useState<DemoProgressPayload[]>([]);
  const [progress, setProgress] = useState<number>(0);
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Parada de emergência / Encerramento do Stream
  const stopDemo = useCallback(() => {
    demoStreamService.unsubscribe();
    setIsStreaming(false);
  }, []);

  // Reseta o estado local do hook para uma nova extração
  const resetDemo = useCallback(() => {
    stopDemo();
    setLogs([]);
    setProgress(0);
    setError(null);
  }, [stopDemo]);

  // Função principal exposta para ser chamada no envio do formulário
  const startDemo = useCallback(async (urls: string[]) => {
    resetDemo();
    setIsStreaming(true);

    try {
      // 1. Dispara a requisição HTTP POST para enfileirar as URLs no RabbitMQ
      await demoStreamService.requestDemo(urls);

      // 2. Conecta ao SSE para escutar as atualizações publicadas pelo Redis
      demoStreamService.subscribeToDemoStream(
        // Callback anônimo de mensagem (O que acontece quando chega dado do Redis)
        (data: DemoProgressPayload) => {
          setLogs((prevLogs) => [...prevLogs, data]);

          if (typeof data.progress === 'number') {
            setProgress(data.progress);
          }

          // Se o worker notificar término ou falha na extração, encerra o stream
          if (data.step === 'FINISHED' || data.step === 'COMPLETED') {
            stopDemo();
          } else if (data.step === 'ERROR') {
            setError(data.message || 'Ocorreu um erro no processamento do produto.');
            stopDemo();
          }
        },
        // Callback anônimo de erro (O que acontece se a conexão de rede cair)
        (_errEvent) => {
          setError('A conexão com a transmissão em tempo real foi perdida.');
          stopDemo();
        }
      );
    } catch (err: any) {
      const detail = err.response?.data?.detail || 'Falha ao iniciar a solicitação de demo.';
      setError(detail);
      setIsStreaming(false);
    }
  }, [resetDemo, stopDemo]);

  // Clean-up no ciclo de vida: Se a tela/componente desmontar, fecha a conexão SSE
  useEffect(() => {
    return () => {
      demoStreamService.unsubscribe();
    };
  }, []);

  return {
    logs,
    progress,
    isStreaming,
    error,
    startDemo,
    stopDemo,
    resetDemo,
  };
};