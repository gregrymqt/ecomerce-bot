/**
 * src/features/analytics/services/trafficAnalytics.service.ts
 *
 * Serviço para consulta de métricas de tráfego, vendas por criativo
 * e verificação de instalação da tag tracker.js na loja do lojista.
 */

import { apiClient } from '@/lib/apiClient';
import { getErrorMessage } from '@/utils/errors';
import type { TenantTrafficOverview, VerifyTagResponse } from '../types/traffic.types';

export const trafficAnalyticsService = {
  async getTrafficOverview(days: number = 30, source?: string): Promise<TenantTrafficOverview> {
    try {
      const params = new URLSearchParams({ days: days.toString() });
      if (source) params.append('source', source);
      const response = await apiClient.get<TenantTrafficOverview>(
        `/api/v1/analytics/traffic?${params.toString()}`
      );
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error, 'Falha ao obter visão geral de tráfego.'), { cause: error });
    }
  },

  async verifyStoreTag(storeUrl: string): Promise<VerifyTagResponse> {
    try {
      const response = await apiClient.post<VerifyTagResponse>(
        '/api/v1/analytics/traffic/verify-tag',
        {
          store_url: storeUrl,
        }
      );
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error, 'Falha ao verificar tag de rastreamento na loja.'), { cause: error });
    }
  },
};

export default trafficAnalyticsService;
