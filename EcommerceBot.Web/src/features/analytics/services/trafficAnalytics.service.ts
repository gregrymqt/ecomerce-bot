/**
 * src/features/analytics/services/trafficAnalytics.service.ts
 *
 * Serviço para consulta de métricas de tráfego, vendas por criativo
 * e verificação de instalação da tag tracker.js na loja do lojista.
 */

import { apiClient } from '@/lib/apiClient';

export interface SourcePerformance {
  source: string;
  visits_count: number;
  orders_count: number;
  conversion_rate: number;
  revenue_brl: number;
}

export interface CreativePerformance {
  ad_id: string;
  campaign: string;
  source: string;
  orders_count: number;
  total_revenue_brl: number;
  average_ticket_brl: number;
}

export interface TenantTrafficOverview {
  total_attributed_revenue_brl: number;
  total_tracked_orders: number;
  total_visits: number;
  average_ticket_brl: number;
  top_source: string;
  period_days: number;
  sources: SourcePerformance[];
  creatives: CreativePerformance[];
}

export interface VerifyTagResponse {
  is_installed: boolean;
  store_url: string;
  checked_at: string;
  message: string;
}

export const trafficAnalyticsService = {
  async getTrafficOverview(days: number = 30, source?: string): Promise<TenantTrafficOverview> {
    const params = new URLSearchParams({ days: days.toString() });
    if (source) params.append('source', source);
    const response = await apiClient.get<TenantTrafficOverview>(`/analytics/traffic?${params.toString()}`);
    return response.data;
  },

  async verifyStoreTag(storeUrl: string): Promise<VerifyTagResponse> {
    const response = await apiClient.post<VerifyTagResponse>('/analytics/traffic/verify-tag', {
      store_url: storeUrl,
    });
    return response.data;
  },
};

export default trafficAnalyticsService;
