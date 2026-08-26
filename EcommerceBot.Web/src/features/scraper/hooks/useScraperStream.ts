import { useState, useEffect, useCallback, useRef } from 'react';
import { SSEClient } from '@/lib/sseClient';
import type { ScraperStreamEvent, UseScraperStreamReturn } from '@/features/scraper';

export const useScraperStream = (): UseScraperStreamReturn => {
  const [events, setEvents] = useState<ScraperStreamEvent[]>([]);
  const [progress, setProgress] = useState<number>(0);
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastEvent, setLastEvent] = useState<ScraperStreamEvent | null>(null);

  const sseClientRef = useRef<SSEClient<ScraperStreamEvent> | null>(null);

  const disconnect = useCallback(() => {
    sseClientRef.current?.close();
    sseClientRef.current = null;
    setIsStreaming(false);
  }, []);

  const connect = useCallback(() => {
    disconnect();

    const client = new SSEClient<ScraperStreamEvent>();
    sseClientRef.current = client;

    setIsStreaming(true);
    setError(null);

    client.connect({
      endpoint: '/api/v1/demo/stream',
      onMessage: (data: ScraperStreamEvent) => {
        setEvents((prev) => [...prev, data]);
        setLastEvent(data);

        if (typeof data.progress === 'number') {
          setProgress(data.progress);
        }

        if (data.status === 'completed') {
          setIsStreaming(false);
        } else if (data.status === 'failed') {
          setError(data.error || 'O processamento falhou.');
          setIsStreaming(false);
        }
      },
      onError: () => {
        setError('A conexão com a transmissão em tempo real foi perdida.');
        setIsStreaming(false);
      },
    });
  }, [disconnect]);

  useEffect(() => {
    return () => {
      sseClientRef.current?.close();
      sseClientRef.current = null;
    };
  }, []);

  return {
    events,
    progress,
    isStreaming,
    error,
    lastEvent,
    connect,
    disconnect,
  };
};
