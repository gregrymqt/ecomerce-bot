import { apiClient } from '@/lib/apiClient';
import type {
  AiCapacityOverviewResponse,
  AiCreditTopupPayload,
  AiProviderCredit,
} from '../types/aiCapacity.types';

export const aiCapacityService = {
  getOverview: async (days = 30): Promise<AiCapacityOverviewResponse> => {
    const response = await apiClient.get<AiCapacityOverviewResponse>(
      `/api/v1/admin/ai-capacity/overview?days=${days}`
    );
    return response.data;
  },

  registerTopup: async (payload: AiCreditTopupPayload): Promise<AiProviderCredit> => {
    const response = await apiClient.post<AiProviderCredit>(
      '/api/v1/admin/ai-capacity/topup',
      payload
    );
    return response.data;
  },

  triggerRecalculation: async (): Promise<{ success: boolean; message: string }> => {
    const response = await apiClient.post<{ success: boolean; message: string }>(
      '/api/v1/admin/ai-capacity/trigger'
    );
    return response.data;
  },
};

export default aiCapacityService;
