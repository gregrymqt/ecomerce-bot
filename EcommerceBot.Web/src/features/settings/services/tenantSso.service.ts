/**
 * src/features/settings/services/tenantSso.service.ts
 *
 * Serviço de comunicação com a API para listagem de Roles e Mapeamentos de Grupos SSO (/api/v1/sso/*).
 */

import { apiClient } from '@/lib/apiClient';
import { getErrorMessage } from '@/utils/errors';
import type {
  Role,
  TenantSsoMapping,
  CreateTenantSsoMappingPayload,
  UpdateTenantSsoMappingPayload,
} from '../types';

export const tenantSsoService = {
  async getRoles(): Promise<Role[]> {
    try {
      const response = await apiClient.get<Role[]>('/api/v1/sso/roles');
      return response.data;
    } catch (error: unknown) {
      const msg = getErrorMessage(error, 'Erro ao listar papéis de usuário.');
      throw new Error(msg, { cause: error });
    }
  },

  async getMappings(): Promise<TenantSsoMapping[]> {
    try {
      const response = await apiClient.get<TenantSsoMapping[]>('/api/v1/sso/mappings');
      return response.data;
    } catch (error: unknown) {
      const msg = getErrorMessage(error, 'Erro ao consultar mapeamentos de grupos SSO.');
      throw new Error(msg, { cause: error });
    }
  },

  async createMapping(payload: CreateTenantSsoMappingPayload): Promise<TenantSsoMapping> {
    try {
      const response = await apiClient.post<TenantSsoMapping>('/api/v1/sso/mappings', payload);
      return response.data;
    } catch (error: unknown) {
      const msg = getErrorMessage(error, 'Erro ao criar mapeamento SSO.');
      throw new Error(msg, { cause: error });
    }
  },

  async updateMapping(id: string, payload: UpdateTenantSsoMappingPayload): Promise<{ success: boolean; message: string }> {
    try {
      const response = await apiClient.put<{ success: boolean; message: string }>(`/api/v1/sso/mappings/${id}`, payload);
      return response.data;
    } catch (error: unknown) {
      const msg = getErrorMessage(error, 'Erro ao atualizar mapeamento SSO.');
      throw new Error(msg, { cause: error });
    }
  },

  async deleteMapping(id: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await apiClient.delete<{ success: boolean; message: string }>(`/api/v1/sso/mappings/${id}`);
      return response.data;
    } catch (error: unknown) {
      const msg = getErrorMessage(error, 'Erro ao remover mapeamento SSO.');
      throw new Error(msg, { cause: error });
    }
  },
};

export default tenantSsoService;
