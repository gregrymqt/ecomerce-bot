import { useState, useEffect, useCallback } from 'react';
import { demoStreamService } from '../services/demoStreamService';
import { getErrorMessage } from '@/utils/errors';
import type { UseDemoStreamReturn, DemoProgressPayload } from '../types/live-demo.type';

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
    } catch (err: unknown) {
      const detail = getErrorMessage(err, 'Falha ao iniciar a solicitação de demo.');
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