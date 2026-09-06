import { apiClient } from '@/lib/apiClient';
import { getErrorMessage } from '@/utils/errors';
import type {
  AiCapacityOverviewResponse,
  AiCreditTopupPayload,
  AiProviderCredit,
} from '../types/aiCapacity.types';

export const aiCapacityService = {
  getOverview: async (days = 30): Promise<AiCapacityOverviewResponse> => {
    try {
      const response = await apiClient.get<AiCapacityOverviewResponse>(
        `/api/v1/admin/ai-capacity/overview?days=${days}`
      );
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error, 'Falha ao obter telemetria de capacidade de IA.'), { cause: error });
    }
  },

  registerTopup: async (payload: AiCreditTopupPayload): Promise<AiProviderCredit> => {
    try {
      const response = await apiClient.post<AiProviderCredit>(
        '/api/v1/admin/ai-capacity/topup',
        payload
      );
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error, 'Falha ao registrar recarga de créditos de IA.'), { cause: error });
    }
  },

  triggerRecalculation: async (): Promise<{ success: boolean; message: string }> => {
    try {
      const response = await apiClient.post<{ success: boolean; message: string }>(
        '/api/v1/admin/ai-capacity/trigger'
      );
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error, 'Falha ao acionar recálculo de capacidade.'), { cause: error });
    }
  },
};

export default aiCapacityService;
