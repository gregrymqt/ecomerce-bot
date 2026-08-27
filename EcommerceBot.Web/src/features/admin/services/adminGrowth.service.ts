/**
 * src/features/admin/services/adminGrowth.service.ts
 *
 * Serviço de comunicação com a API administrativa para Funil de Aquisição,
 * Unit Economics (CAC, LTV, Margem Real) e Lançamento de Gastos em Anúncios.
 */

import { apiClient } from '@/lib/apiClient';

export interface AcquisitionFunnelData {
  total_visitors: number;
  total_signups: number;
  total_paying_customers: number;
  visitor_to_signup_rate: number;
  signup_to_paid_rate: number;
  overall_conversion_rate: number;
  period_days: number;
}

export interface CampaignPerformanceRow {
  utm_source: string;
  utm_campaign: string;
  ad_id?: string;
  visitors_count: number;
  signups_count: number;
  paying_customers_count: number;
  gross_revenue_brl: number;
  llm_cost_brl: number;
  ad_spend_brl: number;
  net_margin_brl: number;
  roas: number;
  cac_brl: number;
}

export interface UnitEconomicsData {
  total_ad_spend_brl: number;
  total_gross_revenue_brl: number;
  total_llm_cost_brl: number;
  net_profit_brl: number;
  average_cac_brl: number;
  average_ltv_brl: number;
  ltv_cac_ratio: number;
  payback_months: number;
  campaigns: CampaignPerformanceRow[];
}

export interface CreateAdSpendPayload {
  campaign_name: string;
  utm_source: string;
  ad_id?: string;
  amount_spent_brl: number;
  period_start: string;
  period_end: string;
  notes?: string;
}

export const adminGrowthService = {
  async getAcquisitionFunnel(days: number = 30): Promise<AcquisitionFunnelData> {
    const response = await apiClient.get<AcquisitionFunnelData>(`/admin/analytics/acquisition?days=${days}`);
    return response.data;
  },

  async getUnitEconomics(days: number = 30): Promise<UnitEconomicsData> {
    const response = await apiClient.get<UnitEconomicsData>(`/admin/analytics/unit-economics?days=${days}`);
    return response.data;
  },

  async createAdSpend(payload: CreateAdSpendPayload): Promise<{ success: boolean; id: string }> {
    const response = await apiClient.post<{ success: boolean; id: string }>('/admin/analytics/ad-spend', payload);
    return response.data;
  },
};

export default adminGrowthService;
