import { apiClient } from '@/lib/apiClient';
import type { AICredentialsRequest, AICredentialsResponse } from '../types/keys.type';

export const keysService = {
  /**
   * Salva ou atualiza a chave de API (BYOK) criptografada no backend.
   */
  saveCredentials: async (payload: AICredentialsRequest): Promise<AICredentialsResponse> => {
    const response = await apiClient.post<AICredentialsResponse>('/api/v1/ai/credentials', payload);
    return response.data;
  },
};