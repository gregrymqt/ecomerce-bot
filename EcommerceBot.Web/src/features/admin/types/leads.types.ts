/**
 * src/features/admin/types/leads.types.ts
 *
 * Contratos de dados para o Mini-CRM de Leads SSO Enterprise e Provisionamento de Contas.
 */

export type LeadStatus = 'PENDING' | 'CONTACTED' | 'QUALIFIED' | 'CONVERTED' | 'REJECTED';

export interface EnterpriseLead {
  id: string;
  email: string;
  companyName?: string;
  jobTitle?: string;
  expectedVolume?: string;
  phone?: string;
  teamSize?: string;
  notes?: string;
  status: LeadStatus;
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
