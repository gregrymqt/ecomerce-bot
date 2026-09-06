/**
 * src/features/admin/services/adminLeads.service.ts
 *
 * Serviço de comunicação com a API administrativa para o Mini-CRM de Leads SSO Enterprise.
 */

import { apiClient } from '@/lib/apiClient';
import { getErrorMessage } from '@/utils/errors';
import type {
  EnterpriseLeadsListResponse,
  UpdateLeadStatusPayload,
  ProvisionEnterprisePayload,
  ProvisionEnterpriseResponse,
} from '../types/leads.types';

export const adminLeadsService = {
  async getLeads(
    status?: string,
    search?: string,
    page: number = 1,
    pageSize: number = 100
  ): Promise<EnterpriseLeadsListResponse> {
    try {
      const params = new URLSearchParams();
      if (status && status !== 'ALL') params.append('status', status);
      if (search && search.trim()) params.append('search', search.trim());
      params.append('page', page.toString());
      params.append('pageSize', pageSize.toString());

      const response = await apiClient.get<EnterpriseLeadsListResponse>(
        `/api/v1/admin/enterprise-leads?${params.toString()}`
      );
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error, 'Falha ao buscar leads enterprise do CRM.'), { cause: error });
    }
  },

  async updateStatus(
    id: string,
    payload: UpdateLeadStatusPayload
  ): Promise<{ success: boolean; message: string }> {
    try {
      const response = await apiClient.patch<{ success: boolean; message: string }>(
        `/api/v1/admin/enterprise-leads/${id}/status`,
        payload
      );
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error, 'Falha ao atualizar status do lead.'), { cause: error });
    }
  },

  async provisionAccount(
    id: string,
    payload: ProvisionEnterprisePayload
  ): Promise<ProvisionEnterpriseResponse> {
    try {
      const response = await apiClient.post<ProvisionEnterpriseResponse>(
        `/api/v1/admin/enterprise-leads/${id}/provision`,
        payload
      );
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error, 'Falha ao provisionar conta enterprise.'), { cause: error });
    }
  },
};

export default adminLeadsService;
