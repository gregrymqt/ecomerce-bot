/**
 * src/features/admin/services/adminLeads.service.ts
 *
 * Servi�o de comunica��o com a API administrativa para o Mini-CRM de Leads SSO Enterprise.
 */

import { apiClient } from '@/lib/apiClient';

export interface EnterpriseLead {
  id: string;
  email: string;
  companyName?: string;
  jobTitle?: string;
  expectedVolume?: string;
  phone?: string;
  teamSize?: string;
  notes?: string;
  status: 'PENDING' | 'CONTACTED' | 'QUALIFIED' | 'CONVERTED' | 'REJECTED';
  internalNotes?: string;
  convertedTenantId?: string;
  convertedUserId?: string;
  ipAddress?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EnterpriseLeadsSummaryMetrics {
  totalLeads: number;
  pendingCount: number;
  contactedCount: number;
  qualifiedCount: number;
  convertedCount: number;
  rejectedCount: number;
}

export interface EnterpriseLeadsListResponse {
  leads: EnterpriseLead[];
  metrics: EnterpriseLeadsSummaryMetrics;
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface UpdateLeadStatusPayload {
  status: string;
  internalNotes?: string;
}

export interface ProvisionEnterprisePayload {
  tenantName?: string;
  adminFullName?: string;
  temporaryPassword?: string;
  creditsBalance?: number;
  managedCreditBalance?: number;
  internalNotes?: string;
}

export interface ProvisionEnterpriseResponse {
  leadId: string;
  tenantId: string;
  userId: string;
  tenantName: string;
  adminEmail: string;
  planTier: string;
  creditsBalance: number;
  status: string;
  message: string;
}

export const adminLeadsService = {
  async getLeads(
    status?: string,
    search?: string,
    page: number = 1,
    pageSize: number = 100
  ): Promise<EnterpriseLeadsListResponse> {
    const params = new URLSearchParams();
    if (status && status !== 'ALL') params.append('status', status);
    if (search && search.trim()) params.append('search', search.trim());
    params.append('page', page.toString());
    params.append('pageSize', pageSize.toString());

    const response = await apiClient.get<EnterpriseLeadsListResponse>(
      `/api/v1/admin/enterprise-leads?${params.toString()}`
    );
    return response.data;
  },

  async updateStatus(
    id: string,
    payload: UpdateLeadStatusPayload
  ): Promise<{ success: boolean; message: string }> {
    const response = await apiClient.patch<{ success: boolean; message: string }>(
      `/api/v1/admin/enterprise-leads/${id}/status`,
      payload
    );
    return response.data;
  },

  async provisionAccount(
    id: string,
    payload: ProvisionEnterprisePayload
  ): Promise<ProvisionEnterpriseResponse> {
    const response = await apiClient.post<ProvisionEnterpriseResponse>(
      `/api/v1/admin/enterprise-leads/${id}/provision`,
      payload
    );
    return response.data;
  },
};

export default adminLeadsService;
