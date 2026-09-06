/**
 * src/features/scraper/hooks/useScraperBatch.ts
 *
 * Custom hook para validação, enfileiramento e ingestão de produtos em lote.
 * Encapsula iteração sequencial, controle de status da fila e chamadas ao scraperService.
 */

import { useState, useCallback } from 'react';
import { scraperService } from '../services/scraper.service';
import type { BatchQueueItem, UseScraperBatchReturn } from '../types';
import { getErrorMessage } from '@/utils/errors';

export function useScraperBatch(): UseScraperBatchReturn {
  const [batchRawText, setBatchRawText] = useState<string>('');
  const [batchQueue, setBatchQueue] = useState<BatchQueueItem[]>([]);
  const [isBatchProcessing, setIsBatchProcessing] = useState<boolean>(false);
  const [batchProgress, setBatchProgress] = useState<number>(0);

  const handleStartBatch = useCallback(
    async (e?: React.FormEvent) => {
      if (e) {
        e.preventDefault();
      }

      const urls = batchRawText
        .split('\n')
        .map((u) => u.trim())
        .filter((u) => u.startsWith('http://') || u.startsWith('https://'));

      if (urls.length === 0) return;

      const initialQueue: BatchQueueItem[] = urls.map((u, idx) => ({
        id: idx,
        url: u,
        status: 'pending',
      }));

      setBatchQueue(initialQueue);
      setIsBatchProcessing(true);
      setBatchProgress(0);

      for (let i = 0; i < initialQueue.length; i++) {
        setBatchQueue((prev) =>
          prev.map((item, idx) => (idx === i ? { ...item, status: 'sending' } : item))
        );

        try {
          await scraperService.extractUrl({ url: initialQueue[i].url });
          setBatchQueue((prev) =>
            prev.map((item, idx) => (idx === i ? { ...item, status: 'completed' } : item))
          );
        } catch (err: unknown) {
          const errorMsg = getErrorMessage(err, 'Falha no enfileiramento');
          setBatchQueue((prev) =>
            prev.map((item, idx) =>
              idx === i ? { ...item, status: 'failed', error: errorMsg } : item
            )
          );
        }

        const percent = Math.round(((i + 1) / initialQueue.length) * 100);
        setBatchProgress(percent);
      }

      setIsBatchProcessing(false);
    },
    [batchRawText]
  );

  const resetBatch = useCallback(() => {
    setBatchRawText('');
    setBatchQueue([]);
    setIsBatchProcessing(false);
    setBatchProgress(0);
  }, []);

  return {
    batchRawText,
    setBatchRawText,
    batchQueue,
    isBatchProcessing,
    batchProgress,
    handleStartBatch,
    resetBatch,
  };
}

export default useScraperBatch;
