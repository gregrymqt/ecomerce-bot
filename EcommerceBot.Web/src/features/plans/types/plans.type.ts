/**
 * src/features/plans/types/plans.type.ts
 *
 * Contratos de tipos e DTOs canônicos para a feature Planos de Assinatura.
 * Alinhado estritamente com a API ASP.NET Core (EcommerceBot.Application.DTOs.Plans)
 * com compatibilidade para o ecossistema Mercado Pago Preapproval.
 */

export interface CreatePlanRequest {
  name: string;
  description?: string;
  price: number;
  creditsIncluded: number;
  billingInterval: string;
  mpPreapprovalPlanId?: string;
  trialDays: number;
  isActive: boolean;
}

export interface UpdatePlanRequest {
  name?: string;
  description?: string;
  price?: number;
  creditsIncluded?: number;
  billingInterval?: string;
  mpPreapprovalPlanId?: string;
  trialDays?: number;
  isActive?: boolean;
}

export interface PlanResponse {
  id: string;
  name: string;
  description?: string;
  price: number;
  creditsIncluded: number;
  billingInterval: string;
  mpPreapprovalPlanId?: string;
  trialDays: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  // Campos de compatibilidade com interfaces legadas / Mercado Pago
  reason?: string;
  external_id?: string;
  status?: string;
  init_point?: string;
  auto_recurring?: {
    frequency?: number;
    frequency_type?: string;
    transaction_amount?: number;
    currency_id?: string;
    free_trial?: {
      frequency: number;
      frequency_type: string;
    };
    [key: string]: unknown;
  };
}

export interface SearchPlansQueryParams {
  status?: string;
  q?: string;
  sort?: string;
  criteria?: string;
  offset?: number;
  limit?: number;
}

export interface PagingDTO {
  offset: number;
  limit: number;
  total: number;
}

export interface PlanSearchResponse {
  paging: PagingDTO;
  results: PlanResponse[];
}
