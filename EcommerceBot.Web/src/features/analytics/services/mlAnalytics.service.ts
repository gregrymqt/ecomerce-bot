/**
 * src/features/analytics/services/mlAnalytics.service.ts
 *
 * Cliente para os endpoints de Machine Learning do Core API (.NET 9):
 * Segmentação RFM, Predição de Churn e Projeção de LTV (Lifetime Value).
 */

import { apiClient } from '@/lib/apiClient';
import type { MlInsightsResponse } from '../types/ml.types';

export const mlAnalyticsService = {
  async triggerAnalysis(jobType: string = 'FULL_ANALYTICS'): Promise<{ status: string; message: string }> {
    const response = await apiClient.post<{ status: string; message: string }>(
      '/api/v1/analytics/ml/trigger',
      { jobType }
    );
    return response.data;
  },

  async getLatestInsights(): Promise<MlInsightsResponse> {
    const response = await apiClient.get<MlInsightsResponse>('/api/v1/analytics/ml/insights');
    return response.data;
  },
};

export default mlAnalyticsService;
