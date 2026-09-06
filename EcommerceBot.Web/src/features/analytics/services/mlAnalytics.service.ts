/**
 * src/features/analytics/services/mlAnalytics.service.ts
 *
 * Cliente para os endpoints de Machine Learning do Core API (.NET 9):
 * Segmentação RFM, Predição de Churn e Projeção de LTV (Lifetime Value).
 */

import { apiClient } from '@/lib/apiClient';
import { getErrorMessage } from '@/utils/errors';
import type { MlInsightsResponse } from '../types/ml.types';

export const mlAnalyticsService = {
  async triggerAnalysis(jobType: string = 'FULL_ANALYTICS'): Promise<{ status: string; message: string }> {
    try {
      const response = await apiClient.post<{ status: string; message: string }>(
        '/api/v1/analytics/ml/trigger',
        { jobType }
      );
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error, 'Falha ao disparar análise preditiva de IA.'), { cause: error });
    }
  },

  async getLatestInsights(): Promise<MlInsightsResponse> {
    try {
      const response = await apiClient.get<MlInsightsResponse>('/api/v1/analytics/ml/insights');
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error, 'Falha ao obter insights de Machine Learning.'), { cause: error });
    }
  },
};

export default mlAnalyticsService;
