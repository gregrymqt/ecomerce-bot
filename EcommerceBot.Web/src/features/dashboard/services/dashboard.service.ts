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
  RobotActivityStatus,
  SystemHealthItem,
  SystemHealthStatus,
  TokenProviderUsage,
  VolumeChartItem,
} from '../types';

interface BackendProductStatusSummary {
  raw?: number;
  processing?: number;
  processed?: number;
  failed?: number;
}

interface BackendTokenTelemetrySchema {
  provider: string;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalTokens: number;
  isByok?: boolean;
}

interface BackendVolumeChartPoint {
  label: string;
  rawCount: number;
  processedCount: number;
}

interface BackendDashboardTelemetryResponse {
  productStatus?: BackendProductStatusSummary;
  tokenUsage?: BackendTokenTelemetrySchema[];
  averageLatencyMs?: number;
  hoursSaved?: number;
  creditsBalance?: number;
  creditsTotal?: number;
  volumeChart?: BackendVolumeChartPoint[];
  // Compatibilidade se o payload já estiver no formato normalizado
  kpis?: DashboardTelemetryResponse['kpis'];
  chart_data?: VolumeChartItem[];
  recent_activities?: RobotActivity[];
  token_telemetry?: TokenProviderUsage[];
  average_latency_ms?: number;
  system_health?: SystemHealthItem[];
}

interface BackendRobotActivityDto {
  id: string;
  workerType?: string;
  status?: string;
  detailsJson?: string | null;
  durationMs?: number | null;
  createdAt?: string;
}

interface BackendSystemHealthResponse {
  status?: string;
  services?: Record<string, string>;
}

function formatCompactTokens(tokens: number): string {
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(1)}M`;
  }
  if (tokens >= 1_000) {
    return `${(tokens / 1_000).toFixed(1)}K`;
  }
  return String(tokens);
}

function formatRelativeTime(isoDate?: string): string {
  if (!isoDate) return '-';
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return '-';
  const diffMinutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60_000));
  if (diffMinutes < 1) return 'Agora';
  if (diffMinutes < 60) return `Há ${diffMinutes} min`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `Há ${diffHours}h`;
  return date.toLocaleDateString('pt-BR');
}

function mapActivityStatus(rawStatus?: string): RobotActivityStatus {
  const upper = (rawStatus || '').toUpperCase();
  if (upper.includes('FAIL') || upper.includes('ERR')) return 'FAILED';
  if (upper.includes('PROC') || upper.includes('PEND') || upper.includes('QUEU')) return 'PROCESSING';
  return 'SUCCESS';
}

function mapRobotActivity(dto: BackendRobotActivityDto): RobotActivity {
  let productTitle = dto.workerType || 'Job do Pipeline';
  let domain = '-';
  let aiProvider = dto.workerType || 'OPENROUTER';

  if (dto.detailsJson) {
    try {
      const parsed = JSON.parse(dto.detailsJson) as Record<string, unknown>;
      if (typeof parsed.product_title === 'string') productTitle = parsed.product_title;
      else if (typeof parsed.title === 'string') productTitle = parsed.title;
      else if (typeof parsed.sku === 'string') productTitle = `SKU ${parsed.sku}`;

      if (typeof parsed.domain === 'string') domain = parsed.domain;
      else if (typeof parsed.url === 'string') {
        domain = new URL(parsed.url).hostname;
      }

      if (typeof parsed.ai_provider === 'string') aiProvider = parsed.ai_provider;
      else if (typeof parsed.model === 'string') aiProvider = parsed.model;
    } catch {
      // Mantém fallback seguro se detailsJson não for JSON estruturado
    }
  }

  return {
    id: dto.id,
    product_title: productTitle,
    domain,
    ai_provider: aiProvider,
    status: mapActivityStatus(dto.status),
    created_at_relative: formatRelativeTime(dto.createdAt),
  };
}

function mapSystemHealth(health?: BackendSystemHealthResponse | null): SystemHealthItem[] {
  if (!health?.services) return [];

  return Object.entries(health.services).map(([serviceName, state]) => {
    const normalized = (state || '').toUpperCase();
    let status: SystemHealthStatus = 'DEGRADED';
    if (normalized === 'UP' || normalized === 'OK' || normalized === 'ONLINE') {
      status = 'ONLINE';
    } else if (normalized === 'DOWN' || normalized === 'OFFLINE' || normalized === 'ERROR') {
      status = 'OFFLINE';
    }

    return {
      service_name: serviceName,
      status,
      details: state,
    };
  });
}

function mapTelemetryResponse(
  raw: BackendDashboardTelemetryResponse,
  activities: RobotActivity[],
  healthItems: SystemHealthItem[]
): DashboardTelemetryResponse {
  if (raw.kpis) {
    return {
      kpis: raw.kpis,
      chart_data: raw.chart_data ?? [],
      recent_activities: raw.recent_activities ?? activities,
      token_telemetry: raw.token_telemetry ?? [],
      average_latency_ms: raw.average_latency_ms ?? 0,
      system_health: raw.system_health ?? healthItems,
    };
  }

  const rawCount = raw.productStatus?.raw ?? 0;
  const processingCount = raw.productStatus?.processing ?? 0;
  const processedCount = raw.productStatus?.processed ?? 0;
  const failedCount = raw.productStatus?.failed ?? 0;
  const totalExtracted = rawCount + processingCount + processedCount + failedCount;
  const finishedTotal = processedCount + failedCount;
  const successRate =
    finishedTotal > 0 ? Math.round((processedCount / finishedTotal) * 1000) / 10 : 0;

  const creditsRemaining = raw.creditsBalance ?? 0;
  const creditsTotal = raw.creditsTotal ?? creditsRemaining;

  const tokenList = raw.tokenUsage ?? [];
  const totalTokensAll = tokenList.reduce((sum, t) => sum + (t.totalTokens ?? 0), 0);

  const tokenTelemetry: TokenProviderUsage[] = tokenList.map((item) => {
    const used = item.totalTokens ?? 0;
    const isByok = Boolean(item.isByok);
    const pct = totalTokensAll > 0 ? Math.round((used / totalTokensAll) * 100) : 0;

    return {
      provider_name: `${item.provider || 'OPENROUTER'}${isByok ? ' (BYOK)' : ' (SaaS)'}`,
      used_tokens_display: formatCompactTokens(used),
      max_tokens_display: formatCompactTokens(totalTokensAll),
      percentage: pct,
      is_byok: isByok,
    };
  });

  const chartData: VolumeChartItem[] = (raw.volumeChart ?? []).map((pt) => ({
    label: pt.label,
    raw_count: pt.rawCount ?? 0,
    processed_count: pt.processedCount ?? 0,
  }));

  return {
    kpis: {
      total_extracted: totalExtracted,
      growth_percentage: 0,
      success_rate_percentage: successRate,
      estimated_hours_saved: raw.hoursSaved ?? 0,
      credits_remaining: creditsRemaining,
      credits_total: creditsTotal,
    },
    chart_data: chartData,
    recent_activities: activities,
    token_telemetry: tokenTelemetry,
    average_latency_ms: Math.round(raw.averageLatencyMs ?? 0),
    system_health: healthItems,
  };
}

export const dashboardService = {
  /**
   * Obtém os dados consolidados de telemetria (KPIs, gráfico de volume, robôs e saúde).
   * Endpoints reais: /api/v1/system/telemetry, /api/v1/system/activities, /api/v1/system/health
   */
  getTelemetry: async (period: PeriodFilter = 'WEEK'): Promise<DashboardTelemetryResponse> => {
    try {
      const timeframeMap: Record<PeriodFilter, string> = {
        DAY: '24h',
        WEEK: '7d',
        MONTH: '30d',
      };
      const timeframe = timeframeMap[period] || '7d';

      const [telemetryResult, activitiesResult, healthResult] = await Promise.allSettled([
        apiClient.get<BackendDashboardTelemetryResponse>('/api/v1/system/telemetry', {
          params: { timeframe, period },
        }),
        apiClient.get<BackendRobotActivityDto[]>('/api/v1/system/activities', {
          params: { limit: 10 },
        }),
        apiClient.get<BackendSystemHealthResponse>('/api/v1/system/health'),
      ]);

      if (telemetryResult.status === 'rejected') {
        throw telemetryResult.reason;
      }

      const mappedActivities =
        activitiesResult.status === 'fulfilled' && Array.isArray(activitiesResult.value.data)
          ? activitiesResult.value.data.map(mapRobotActivity)
          : [];

      const mappedHealth =
        healthResult.status === 'fulfilled'
          ? mapSystemHealth(healthResult.value.data)
          : [];

      return mapTelemetryResponse(telemetryResult.value.data, mappedActivities, mappedHealth);
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
   */
  getRecentActivities: async (limit: number = 10): Promise<RobotActivity[]> => {
    try {
      const response = await apiClient.get<BackendRobotActivityDto[]>('/api/v1/system/activities', {
        params: { limit },
      });
      return Array.isArray(response.data) ? response.data.map(mapRobotActivity) : [];
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
