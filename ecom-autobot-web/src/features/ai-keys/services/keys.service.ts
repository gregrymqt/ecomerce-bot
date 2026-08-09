import { apiClient } from '@/lib/apiClient';
import type {
  AICredentialsRequest,
  AICredentialsResponse,
  TestAIKeyRequest,
  TestAIKeyResponse,
} from '@/features/ai-keys';

export const keysService = {
  /**
   * Salva ou atualiza a chave de API (BYOK) criptografada no backend.
   */
  saveCredentials: async (payload: AICredentialsRequest): Promise<AICredentialsResponse> => {
    try {
      const response = await apiClient.post<AICredentialsResponse>('/api/v1/ai-keys', payload);
      return response.data;
    } catch {
      const response = await apiClient.post<AICredentialsResponse>('/api/v1/ai/credentials', payload);
      return response.data;
    }
  },

  /**
   * Testa a autenticidade e validade da chave de API em tempo real.
   */
  testAIKey: async (payload: TestAIKeyRequest): Promise<TestAIKeyResponse> => {
    const response = await apiClient.post<TestAIKeyResponse>('/api/v1/ai-keys/test', payload);
    return response.data;
  },
};