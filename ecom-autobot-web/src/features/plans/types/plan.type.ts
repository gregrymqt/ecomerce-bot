export type FrequencyType = 'days' | 'months';
export type PlanStatus = 'active' | 'canceled';

export interface FreeTrialDTO {
  frequency: number;
  frequency_type: FrequencyType;
}

export interface AutoRecurringDTO {
  frequency: number;
  frequency_type: FrequencyType;
  repetitions?: number | null;
  billing_day?: number | null;
  billing_day_proportional?: boolean | null;
  free_trial?: FreeTrialDTO | null;
  transaction_amount: number;
  currency_id: string;
}

export interface Plan {
  id: string;
  external_id?: string | null;
  application_id?: number | string | null;
  collector_id?: number | string | null;
  reason: string;
  auto_recurring: AutoRecurringDTO | Record<string, any>;
  payment_methods_allowed?: Record<string, any> | null;
  back_url?: string | null;
  external_reference?: number | string | null;
  init_point?: string | null;
  date_created?: string | null;
  last_modified?: string | null;
  status: PlanStatus | string;
  subscribed?: number | null;
}

export interface CreatePlanPayload {
  reason: string;
  auto_recurring: {
    frequency: number;
    frequency_type: FrequencyType;
    transaction_amount: number;
    currency_id?: string;
    billing_day?: number;
    free_trial?: FreeTrialDTO;
  };
  back_url?: string;
  external_id?: string;
}

export interface UpdatePlanPayload {
  reason?: string;
  auto_recurring?: {
    frequency?: number;
    frequency_type?: FrequencyType;
    transaction_amount?: number;
    currency_id?: string;
  };
  back_url?: string;
  status?: PlanStatus;
  external_id?: string;
}

export interface SearchPlansParams {
  status?: string;
  q?: string;
  sort?: string;
  criteria?: string;
  offset?: number;
  limit?: number;
}

export interface PlanSearchResponse {
  paging: {
    offset: number;
    limit: number;
    total: number;
  };
  results: Plan[];
}