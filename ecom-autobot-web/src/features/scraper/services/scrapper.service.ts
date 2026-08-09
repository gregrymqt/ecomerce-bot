import { apiClient } from '@/lib/apiClient';
import type { WebScraperRequest, WebScraperResponse } from '@/features/scraper';

export const scrapperService = {
  /**
   * Dispara a requisição de extração de produto por URL.
   * O header X-Tenant-ID é injetado automaticamente pelo interceptor do apiClient.
   */
  extractUrl: async (payload: WebScraperRequest): Promise<WebScraperResponse> => {
    const response = await apiClient.post<WebScraperResponse>('/api/v1/scraper/extract', payload);
    return response.data;
  },
};