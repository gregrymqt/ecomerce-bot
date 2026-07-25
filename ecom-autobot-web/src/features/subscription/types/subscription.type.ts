export type SubscriptionStatus = 'pending' | 'authorized' | 'paused' | 'cancelled';

export type FrequencyType = 'days' | 'months';

export interface FreeTrialDTO {
  frequency: number;
  frequency_type: FrequencyType;
}

export interface AutoRecurringDTO {
  frequency: number;
  frequency_type: FrequencyType;
  transaction_amount: number;
  currency_id?: string;
  start_date?: string;
  end_date?: string;
  free_trial?: FreeTrialDTO;
}

export interface Subscription {
  id: string;
  tenant_id: string;
  plan_id?: string | null;
  preapproval_id: string;
  payer_email: string;
  status: SubscriptionStatus;
  reason?: string | null;
  external_reference?: string | null;
  init_point?: string | null;
  payment_method_id?: string | null;
  card_id?: string | null;
  next_payment_date?: string | null;
  auto_recurring?: Record<string, any> | null;
  created_at: string;
  updated_at: string;
}

export interface TenantBillingStatus {
  tenant_id: string;
  has_active_subscription: boolean;
  subscription: Subscription | null;
  plan_id: string | null;
  valid_until: string | null;
}

export interface CreateSubscriptionPayload {
  preapproval_plan_id?: string;
  reason?: string;
  external_reference?: string;
  payer_email: string;
  card_token_id?: string;
  auto_recurring?: AutoRecurringDTO;
  back_url?: string;
  status?: SubscriptionStatus;
}

export interface UpdateSubscriptionPayload {
  reason?: string;
  card_token_id?: string;
  auto_recurring?: {
    transaction_amount?: number;
    currency_id?: string;
  };
  back_url?: string;
  status?: SubscriptionStatus;
}

export interface SearchSubscriptionsParams {
  page?: number;
  limit?: number;
  status?: SubscriptionStatus;
  payer_email?: string;
  preapproval_plan_id?: string;
}

export interface PaginatedSubscriptionsResponse {
  paging: {
    page: number;
    limit: number;
    total: number;
  };
  results: Subscription[];
}