/**
 * src/features/analytics/types/ml.types.ts
 *
 * Contratos de dados para Machine Learning & IA Preditiva (RFM, Churn e LTV).
 */

export interface RfmCustomer {
  customerId: string;
  recency: number;
  frequency: number;
  monetary: number;
  r_score: number;
  f_score: number;
  m_score: number;
  rfm_score: string;
  segment: string;
}

export interface RfmSummary {
  total_customers: number;
  total_revenue: number;
  avg_order_value: number;
  avg_frequency: number;
}

export interface RfmData {
  summary: RfmSummary;
  segments: Record<string, number>;
  customers: RfmCustomer[];
}

export type ChurnRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface ChurnPrediction {
  customerId: string;
  riskLevel: ChurnRiskLevel;
  churnProbability: number;
  historicalOrders: number;
  lastOrderDaysAgo: number;
  actionRecommendation: string;
}

export interface ChurnSummary {
  total_evaluated: number;
  high_risk_count: number;
  medium_risk_count: number;
  low_risk_count: number;
  average_churn_probability: number;
}

export interface ChurnData {
  summary: ChurnSummary;
  predictions: ChurnPrediction[];
}

export type LtvCustomerTier = 'DIAMOND' | 'PLATINUM' | 'GOLD' | 'SILVER' | 'BRONZE';

export interface LtvForecast {
  customerId: string;
  customerTier: LtvCustomerTier;
  predictedLtv12m: number;
  historicalRevenue: number;
}

export interface LtvSummary {
  total_customers: number;
  projected_revenue_12m: number;
  avg_projected_ltv_12m: number;
}

export interface LtvData {
  summary: LtvSummary;
  tiers: Record<string, number>;
  forecasts: LtvForecast[];
}

export interface MlInsightsResponse {
  tenantId: string;
  jobType: string;
  status: string;
  lastAnalyzedAt?: string;
  rfm?: RfmData | null;
  churn?: ChurnData | null;
  ltv?: LtvData | null;
  errorMessage?: string | null;
}
