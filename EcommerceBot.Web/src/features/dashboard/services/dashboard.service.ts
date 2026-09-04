/**
 * src/features/dashboard/services/dashboard.service.ts
 *
 * Camada de serviços HTTP para consumo dos endpoints de Telemetria e Dashboard (/api/v1/system/*).
 * Integrado com o apiClient do projeto e tipado com os DTOs do Dashboard.
 */

import { apiClient } from '@/lib/apiClient';
import { getErrorMessage } from '@/utils/errors';
import type {
  DashboardTelemetryResponse,
  PeriodFilter,
  RobotActivity,
} from '../types';

export const dashboardService = {
  /**
   * Obtém os dados consolidados de telemetria (KPIs, gráfico de volume, robôs e saúde).
   * Endpoint primário: GET /api/v1/system/telemetry?timeframe={timeframe}
   *
   * @param period Filtro de período temporal ('DAY' | 'WEEK' | 'MONTH')
   */
  getTelemetry: async (period: PeriodFilter = 'WEEK'): Promise<DashboardTelemetryResponse> => {
    try {
      const timeframeMap: Record<PeriodFilter, string> = {
        DAY: '24h',
        WEEK: '7d',
        MONTH: '30d',
      };
      const timeframe = timeframeMap[period] || '7d';

      // Tenta rota primária da Core API (/api/v1/system/telemetry)
      const response = await apiClient.get<DashboardTelemetryResponse>('/api/v1/system/telemetry', {
        params: { timeframe, period },
      });
      return response.data;
    } catch (error: unknown) {
      const message = getErrorMessage(
        error,
        'Não foi possível carregar os dados de telemetria do Dashboard.'
      );
      throw new Error(message, { cause: error });
    }
  },

  /**
   * Obtém a lista das atividades mais recentes executadas pelos robôs de scraping/IA.
   * Endpoint primário: GET /api/v1/system/activities?limit={limit}
   *
   * @param limit Limite máximo de registros a retornar (padrão 10)
   */
  getRecentActivities: async (limit: number = 10): Promise<RobotActivity[]> => {
    try {
      const response = await apiClient.get<RobotActivity[]>('/api/v1/system/activities', {
        params: { limit },
      });
      return response.data;
    } catch (error: unknown) {
      const message = getErrorMessage(
        error,
        'Erro ao obter o histórico de atividades recentes.'
      );
      throw new Error(message, { cause: error });
    }
  },

  /**
   * Dispara a extração rápida de um produto a partir de sua URL.
   * Endpoint: POST /api/v1/scraper/extract
   *
   * @param url URL de produto para ingestão rápida
   */
  triggerQuickScrape: async (url: string): Promise<void> => {
    try {
      await apiClient.post('/api/v1/scraper/extract', { url });
    } catch (error: unknown) {
      const message = getErrorMessage(
        error,
        'Falha ao iniciar a extração rápida. Verifique a URL informada.'
      );
      throw new Error(message, { cause: error });
    }
  },
};

export default dashboardService;
