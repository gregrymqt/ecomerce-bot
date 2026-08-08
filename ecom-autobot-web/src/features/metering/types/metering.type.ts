export interface TenantCreditBalanceResponse {
  tenant_id: string;
  managed_credit_balance: number;
  is_byok_active: boolean;
  total_tokens_used_30d: number;
  estimated_cost_usd_30d: number;
}

export interface LLMUsageLogResponse {
  id: string;
  tenant_id: string;
  product_id?: string;
  provider: string;
  model_used: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  estimated_cost_usd: number;
  is_byok: boolean;
  execution_time_ms: number;
  created_at: string;
}

export interface LLMUsageFilterParams {
  page?: number;
  limit?: number;
  start_date?: string;
  end_date?: string;
}

export interface PaginatedLLMUsageResponse {
  items: LLMUsageLogResponse[];
  total: number;
  page: number;
  limit: number;
}
