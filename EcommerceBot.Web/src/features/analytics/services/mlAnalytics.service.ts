/**
 * src/features/analytics/services/mlAnalytics.service.ts
 *
 * Cliente para os endpoints de Machine Learning do Core API (.NET 9):
 * Segmentação RFM, Predição de Churn e Projeção de LTV (Lifetime Value).
 */

import { apiClient } from '@/lib/apiClient';

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

export interface ChurnPrediction {
  customerId: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
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

export interface LtvForecast {
  customerId: string;
  customerTier: 'DIAMOND' | 'PLATINUM' | 'GOLD' | 'SILVER' | 'BRONZE';
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

export const mlAnalyticsService = {
  async triggerAnalysis(jobType: string = 'FULL_ANALYTICS'): Promise<{ status: string; message: string }> {
    const response = await apiClient.post<{ status: string; message: string }>('/analytics/ml/trigger', { jobType });
    return response.data;
  },

  async getLatestInsights(): Promise<MlInsightsResponse> {
    const response = await apiClient.get<MlInsightsResponse>('/analytics/ml/insights');
    return response.data;
  },
};
