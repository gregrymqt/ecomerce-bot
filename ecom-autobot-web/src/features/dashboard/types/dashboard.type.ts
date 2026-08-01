/**
 * src/features/dashboard/types/dashboard.type.ts
 *
 * Contratos de tipos e DTOs para a feature de Dashboard Principal e Telemetria.
 * Alinhado estritamente com a arquitetura DDD e os schemas da API FastAPI (ecom-autobot-api).
 */

/**
 * Filtro de período temporal para consolidação das métricas.
 */
export type PeriodFilter = 'DAY' | 'WEEK' | 'MONTH';

/**
 * Status das atividades de raspagem e IA executadas pelos workers.
 */
export type RobotActivityStatus = 'SUCCESS' | 'PROCESSING' | 'FAILED';

/**
 * Status de operacionalidade e saúde de microsserviços do sistema.
 */
export type SystemHealthStatus = 'ONLINE' | 'DEGRADED' | 'OFFLINE';

/**
 * Métricas consolidadas de KPIs exibidas nos cards superiores do Dashboard.
 */
export interface DashboardKpiMetrics {
  /** Quantidade total de produtos extraídos no período */
  total_extracted: number;
  /** Porcentagem de crescimento em comparação ao período anterior */
  growth_percentage: number;
  /** Taxa percentual de sucesso nas operações de raspagem e IA */
  success_rate_percentage: number;
  /** Estimativa de horas de trabalho economizadas pela automação */
  estimated_hours_saved: number;
  /** Quantidade de créditos de IA consumidos */
  credits_used: number;
  /** Limite total de créditos do plano ativo */
  credits_total: number;
}

/**
 * Item individual de contagem para o gráfico de volume de ingestão.
 */
export interface VolumeChartItem {
  /** Rótulo do intervalo temporal (ex: "Seg", "Ter", "01/08") */
  label: string;
  /** Quantidade de produtos em estado bruto (RAW) */
  raw_count: number;
  /** Quantidade de produtos processados e enriquecidos com IA (PROCESSED) */
  processed_count: number;
}

/**
 * Registro de atividade recente executada pelos robôs no tenant.
 */
export interface RobotActivity {
  /** Identificador único da atividade/job */
  id: string;
  /** Título do produto raspado ou enriquecido */
  product_title: string;
  /** Domínio de origem do produto (ex: "amazon.com.br") */
  domain: string;
  /** Provedor de LLM utilizado (ex: "DeepSeek V3", "Groq Llama 3") */
  ai_provider: string;
  /** Status do resultado do job */
  status: RobotActivityStatus;
  /** Tempo relativo da execução (ex: "Há 2 minutos") */
  created_at_relative: string;
}

/**
 * Métrica de consumo de tokens por provedor de IA (BYOK ou Global).
 */
export interface TokenProviderUsage {
  /** Nome amigável do provedor (ex: "OpenAI GPT-4o", "DeepSeek", "Groq") */
  provider_name: string;
  /** Formatação de tokens consumidos (ex: "145.2K") */
  used_tokens_display: string;
  /** Formatação da cota máxima de tokens (ex: "500.0K") */
  max_tokens_display: string;
  /** Percentual de consumo da cota */
  percentage: number;
  /** Indica se está utilizando chave própria do tenant (Bring Your Own Key) */
  is_byok: boolean;
}

/**
 * Item de diagnóstico da saúde de um serviço/infraestrutura.
 */
export interface SystemHealthItem {
  /** Nome do serviço monitorado (ex: "PostgreSQL Database", "Redis Cache", "RabbitMQ Workers") */
  service_name: string;
  /** Estado de saúde do serviço */
  status: SystemHealthStatus;
  /** Detalhes ou mensagem adicional de diagnóstico */
  details?: string;
}

/**
 * Resposta completa consolidada da API de telemetria do Dashboard.
 */
export interface DashboardTelemetryResponse {
  /** KPIs gerais de produto, horas e créditos */
  kpis: DashboardKpiMetrics;
  /** Lista de itens para plotagem do gráfico de volume */
  chart_data: VolumeChartItem[];
  /** Lista das atividades mais recentes executadas pelos robôs */
  recent_activities: RobotActivity[];
  /** Telemetria detalhada de consumo de tokens por provedor de IA */
  token_telemetry: TokenProviderUsage[];
  /** Latência média em milissegundos do pipeline de raspagem/LLM */
  average_latency_ms: number;
  /** Status de operacionalidade de todos os serviços do sistema */
  system_health: SystemHealthItem[];
}
