/**
 * src/features/scraper/hooks/useScraper.ts
 *
 * Custom hook para validação e disparo de extração de URL única.
 */

import { useState, useCallback } from 'react';
import { scraperService } from '../services/scraper.service';
import { getErrorMessage } from '@/utils/errors';
import type { UseScraperReturn } from '../types';

export const useScraper = (): UseScraperReturn => {
  const [url, setUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);

  const submitUrl = useCallback(async () => {
    const trimmed = url.trim();

    if (!trimmed) {
      setError('Por favor, insira a URL do produto.');
      return;
    }

    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        setError('Apenas links HTTP ou HTTPS são suportados.');
        return;
      }
    } catch {
      setError('URL inválida. Ex: https://sualoja.com.br/produto');
      return;
    }

    setIsLoading(true);
    setError(null);
    setTaskId(null);

    try {
      const response = await scraperService.extractUrl({ url: trimmed });
      setTaskId(response.task_id);
    } catch (err: unknown) {
      const detail = getErrorMessage(err, 'Falha ao iniciar a extração.');
      setError(detail);
    } finally {
      setIsLoading(false);
    }
  }, [url]);

  const reset = useCallback(() => {
    setUrl('');
    setIsLoading(false);
    setError(null);
    setTaskId(null);
  }, []);

  return {
    url,
    setUrl,
    isLoading,
    error,
    taskId,
    submitUrl,
    reset,
  };
};

export default useScraper;
