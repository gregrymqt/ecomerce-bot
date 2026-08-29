/**
 * src/features/analytics/types/traffic.types.ts
 *
 * Contratos de dados para Atribuição de Tráfego Pago, Vendas por Criativo e Verificação de Tag.
 */

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
