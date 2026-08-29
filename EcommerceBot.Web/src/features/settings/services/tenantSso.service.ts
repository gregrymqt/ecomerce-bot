/**
 * src/features/settings/services/tenantSso.service.ts
 *
 * Serviço de comunicação com a API para listagem de Roles e Mapeamentos de Grupos SSO.
 */

import { apiClient } from '@/lib/apiClient';

export interface Role {
  id: string;
  name: string;
  description: string;
  isSystemRole: boolean;
}

export interface TenantSsoMapping {
  id: string;
  tenantId: string;
  idpGroupName: string;
  roleId: string;
  roleName: string;
  isDefaultRole: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTenantSsoMappingPayload {
  idpGroupName: string;
  roleId: string;
  isDefaultRole?: boolean;
}

export interface UpdateTenantSsoMappingPayload {
  idpGroupName: string;
  roleId: string;
  isDefaultRole?: boolean;
}

export const tenantSsoService = {
  async getRoles(): Promise<Role[]> {
    const response = await apiClient.get<Role[]>('/api/v1/sso/roles');
    return response.data;
  },

  async getMappings(): Promise<TenantSsoMapping[]> {
    const response = await apiClient.get<TenantSsoMapping[]>('/api/v1/sso/mappings');
    return response.data;
  },

  async createMapping(payload: CreateTenantSsoMappingPayload): Promise<TenantSsoMapping> {
    const response = await apiClient.post<TenantSsoMapping>('/api/v1/sso/mappings', payload);
    return response.data;
  },

  async updateMapping(id: string, payload: UpdateTenantSsoMappingPayload): Promise<{ success: boolean; message: string }> {
    const response = await apiClient.put<{ success: boolean; message: string }>(`/api/v1/sso/mappings/${id}`, payload);
    return response.data;
  },

  async deleteMapping(id: string): Promise<{ success: boolean; message: string }> {
    const response = await apiClient.delete<{ success: boolean; message: string }>(`/api/v1/sso/mappings/${id}`);
    return response.data;
  },
};

export default tenantSsoService;
