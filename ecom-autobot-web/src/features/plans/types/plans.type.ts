/**
 * src/features/plans/types/plans.type.ts
 * Contratos de tipos para a feature Admin de Planos de Assinatura.
 * Alinhado estritamente com os Schemas Pydantic da API FastAPI (PlanResponse, CreatePlanRequest, etc).
 */

export interface FreeTrialDTO {
  frequency: number;
  frequency_type: 'days' | 'months';
}

export interface AutoRecurringCreateDTO {
  frequency: number;
  frequency_type: 'days' | 'months';
  repetitions?: number;
  billing_day?: number;
  billing_day_proportional?: boolean;
  free_trial?: FreeTrialDTO;
  transaction_amount: number;
  currency_id?: string;
}

export interface PaymentMethodItemDTO {
  id: string;
}

export interface PaymentMethodsAllowedDTO {
  payment_types?: PaymentMethodItemDTO[];
  payment_methods?: PaymentMethodItemDTO[];
}

export interface CreatePlanRequest {
  reason: string;
  auto_recurring: AutoRecurringCreateDTO;
  payment_methods_allowed?: PaymentMethodsAllowedDTO;
  back_url?: string;
  external_id?: string;
}

export interface AutoRecurringUpdateDTO {
  frequency?: number;
  frequency_type?: 'days' | 'months';
  repetitions?: number;
  billing_day?: number;
  billing_day_proportional?: boolean;
  free_trial?: FreeTrialDTO;
  transaction_amount?: number;
  currency_id?: string;
}

export interface UpdatePlanRequest {
  reason?: string;
  auto_recurring?: AutoRecurringUpdateDTO;
  payment_methods_allowed?: PaymentMethodsAllowedDTO;
  back_url?: string;
  status?: 'active' | 'canceled';
  external_id?: string;
}

export interface PlanResponse {
  id: string;
  external_id?: string;
  application_id?: number | string;
  collector_id?: number | string;
  reason: string;
  auto_recurring: {
    frequency?: number;
    frequency_type?: string;
    transaction_amount?: number;
    currency_id?: string;
    free_trial?: FreeTrialDTO;
    [key: string]: any;
  };
  payment_methods_allowed?: Record<string, any>;
  back_url?: string;
  external_reference?: number | string;
  init_point?: string;
  date_created?: string;
  last_modified?: string;
  status: 'active' | 'canceled' | string;
  subscribed?: number;
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
