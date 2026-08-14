import { useState, useCallback } from 'react';
import { integrationService } from '../services/integration.service';
import type {
  NuvemshopBatchStockPriceItem,
  NuvemshopBatchStockPriceResponse,
  NuvemshopCategory,
} from '../types/nuvemshop.type';

export function useNuvemshopIntegration() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<NuvemshopCategory[]>([]);

  /**
   * Inicia a autorização OAuth 2.0 da Nuvemshop redirecionando o navegador.
   */
  const initiateOAuth = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await integrationService.getNuvemshopOAuthUrl();
      if (response.oauth_url) {
        window.location.href = response.oauth_url;
        return true;
      }
      throw new Error('URL OAuth não gerada pela Nuvemshop.');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao iniciar autorização da Nuvemshop.';
      setError(message);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Busca as categorias cadastradas na Nuvemshop.
   */
  const fetchCategories = useCallback(async (): Promise<NuvemshopCategory[]> => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await integrationService.getNuvemshopCategories();
      setCategories(data);
      return data;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar categorias da Nuvemshop.';
      setError(message);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Atualização rápida de lote de preço e estoque na Nuvemshop.
   */
  const updateBatchStockPrice = useCallback(
    async (items: NuvemshopBatchStockPriceItem[]): Promise<NuvemshopBatchStockPriceResponse | null> => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await integrationService.updateNuvemshopStockPriceBatch(items);
        return result;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Erro ao atualizar lote de estoque na Nuvemshop.';
        setError(message);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  return {
    isLoading,
    error,
    setError,
    categories,
    initiateOAuth,
    fetchCategories,
    updateBatchStockPrice,
  };
}
