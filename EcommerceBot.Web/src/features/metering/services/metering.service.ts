/**
 * src/features/metering/services/metering.service.ts
 *
 * Camada de serviços HTTP para consumo dos endpoints de Telemetria e Consumo de Créditos (/api/v1/metering/*).
 * Integrado com o apiClient do projeto e tipado com os DTOs de metering.
 */

import { apiClient } from '@/lib/apiClient';
import { getErrorMessage } from '@/utils/errors';
import type {
  TenantCreditBalanceResponse,
  LLMUsageFilterParams,
  PaginatedLLMUsageResponse,
} from '../types';

export const meteringService = {
  /**
   * Obtém o saldo de créditos, status do BYOK e métricas de consumo do tenant.
   * Rota: GET /api/v1/metering/balance
   */
  getCreditBalance: async (): Promise<TenantCreditBalanceResponse> => {
    try {
      const response = await apiClient.get<TenantCreditBalanceResponse>('/api/v1/metering/balance');
      return response.data;
    } catch (error: unknown) {
      const message = getErrorMessage(
        error,
        'Não foi possível carregar o saldo de créditos.'
      );
      throw new Error(message);
    }
  },

  /**
   * Obtém os logs de consumo de LLM paginados com filtros opcionais.
   * Rota: GET /api/v1/metering/usage
   */
  getUsageLogs: async (params?: LLMUsageFilterParams): Promise<PaginatedLLMUsageResponse> => {
    try {
      const response = await apiClient.get<PaginatedLLMUsageResponse>('/api/v1/metering/usage', { params });
      return response.data;
    } catch (error: unknown) {
      const message = getErrorMessage(
        error,
        'Erro ao consultar o histórico de consumo de IA.'
      );
      throw new Error(message);
    }
  },
};

export default meteringService;
