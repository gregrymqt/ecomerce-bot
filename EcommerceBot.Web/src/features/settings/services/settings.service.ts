/**
 * src/features/settings/services/settings.service.ts
 *
 * Camada de serviços HTTP para gestão de configurações do Tenant (/api/v1/settings).
 * Conecta o frontend via apiClient com suporte a mensagens amigáveis em português do Brasil.
 */

import { apiClient } from '@/lib/apiClient';
import { getErrorMessage } from '@/utils/errors';
import type { TenantSettingsResponse } from '../types';

export const settingsService = {
  /**
   * Obtém as configurações consolidadas ativas do Tenant (IA, Perfil da Loja, Faturamento).
   * Endpoint: GET /api/v1/settings
   */
  getSettings: async (): Promise<TenantSettingsResponse> => {
    try {
      const response = await apiClient.get<TenantSettingsResponse>('/api/v1/settings');
      return response.data;
    } catch (error: unknown) {
      const message = getErrorMessage(
        error,
        'Não foi possível carregar as configurações do tenant.'
      );
      throw new Error(message);
    }
  },

  /**
   * Atualiza as configurações do Tenant (parcial ou total).
   * Endpoint: PUT /api/v1/settings
   */
  updateSettings: async (
    payload: Partial<TenantSettingsResponse>
  ): Promise<TenantSettingsResponse> => {
    try {
      const response = await apiClient.put<TenantSettingsResponse>('/api/v1/settings', payload);
      return response.data;
    } catch (error: unknown) {
      const message = getErrorMessage(
        error,
        'Erro ao salvar as alterações de configurações.'
      );
      throw new Error(message);
    }
  },
};

export default settingsService;
