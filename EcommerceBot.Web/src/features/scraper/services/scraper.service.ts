/**
 * src/features/scraper/services/scraper.service.ts
 *
 * Camada de serviços HTTP para consumo dos endpoints de Web Scraping (/api/v1/scraper/*).
 * Integrado com o apiClient do projeto e tipado com os DTOs de scraper.
 */

import { apiClient } from '@/lib/apiClient';
import { getErrorMessage } from '@/utils/errors';
import type { WebScraperRequest, WebScraperResponse } from '../types';

export const scraperService = {
  /**
   * Dispara a requisição de extração de produto por URL em background.
   * O header X-Tenant-ID é injetado automaticamente pelo interceptor do apiClient.
   * Rota: POST /api/v1/scraper/extract
   */
  extractUrl: async (payload: WebScraperRequest): Promise<WebScraperResponse> => {
    try {
      const response = await apiClient.post<WebScraperResponse>('/api/v1/scraper/extract', payload);
      return response.data;
    } catch (error: unknown) {
      const msg = getErrorMessage(error, 'Falha ao solicitar a extração do produto.');
      throw new Error(msg);
    }
  },
};

// Alias de retrocompatibilidade para código existente
export const scrapperService = scraperService;

export default scraperService;
