/**
 * src/features/admin/services/adminGrowth.service.ts
 *
 * Serviço de comunicação com a API administrativa para Funil de Aquisição,
 * Unit Economics (CAC, LTV, Margem Real) e Lançamento de Gastos em Anúncios.
 */

import { apiClient } from '@/lib/apiClient';
import type {
  AcquisitionFunnelData,
  UnitEconomicsData,
  CreateAdSpendPayload,
} from '../types/growth.types';

export const adminGrowthService = {
  async getAcquisitionFunnel(days: number = 30): Promise<AcquisitionFunnelData> {
    const response = await apiClient.get<AcquisitionFunnelData>(
      `/api/v1/admin/analytics/acquisition?days=${days}`
    );
    return response.data;
  },

  async getUnitEconomics(days: number = 30): Promise<UnitEconomicsData> {
    const response = await apiClient.get<UnitEconomicsData>(
      `/api/v1/admin/analytics/unit-economics?days=${days}`
    );
    return response.data;
  },

  async createAdSpend(payload: CreateAdSpendPayload): Promise<{ success: boolean; id: string }> {
    const response = await apiClient.post<{ success: boolean; id: string }>(
      '/api/v1/admin/analytics/ad-spend',
      payload
    );
    return response.data;
  },
};

export default adminGrowthService;
