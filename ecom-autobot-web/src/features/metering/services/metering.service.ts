import { apiClient } from '@/lib/apiClient';
import type {
  TenantCreditBalanceResponse,
  LLMUsageLogResponse,
  LLMUsageFilterParams,
  PaginatedLLMUsageResponse,
} from '../types/metering.type';

export const meteringService = {
  /**
   * Obtém o saldo de créditos, status do BYOK e métricas de consumo do tenant.
   * Rota: GET /api/v1/metering/balance
   */
  getCreditBalance: async (): Promise<TenantCreditBalanceResponse> => {
    const response = await apiClient.get<TenantCreditBalanceResponse>('/api/v1/metering/balance');
    return response.data;
  },

  /**
   * Obtém os logs de consumo de LLM paginados com filtros opcionais.
   * Rota: GET /api/v1/metering/usage
   */
  getUsageLogs: async (params?: LLMUsageFilterParams): Promise<PaginatedLLMUsageResponse> => {
    const response = await apiClient.get<PaginatedLLMUsageResponse>('/api/v1/metering/usage', { params });
    return response.data;
  },
};
