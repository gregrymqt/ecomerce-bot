/**
 * src/features/integrations/types/integration.type.ts
 *
 * Contratos de tipos e DTOs para a feature de Integrações com E-commerces (Shopify, Nuvemshop, WooCommerce).
 * Alinhado estritamente com a arquitetura DDD e os schemas da API FastAPI (ecom-autobot-api).
 */

/**
 * Plataformas de e-commerce suportadas no ecossistema.
 */
export type PlatformType = 'SHOPIFY' | 'NUVEMSHOP' | 'WOOCOMMERCE';

/**
 * Status da conexão com a plataforma de e-commerce.
 */
export type ConnectionStatus = 'CONNECTED' | 'DISCONNECTED' | 'ERROR';

/**
 * Resumo consolidado de métricas e status das integrações do tenant.
 */
export interface IntegrationSummary {
  /** Quantidade de lojas atualmente conectadas */
  connected_stores_count: number;
  /** Limite máximo de lojas permitidas pelo plano ativo */
  max_stores_allowed: number;
  /** Porcentagem de operacionalidade e saúde das APIs integradas */
  api_status_percentage: number;
  /** Timestamp ISO 8601 da última sincronização realizada */
  last_sync_timestamp: string;
}

/**
 * Payload para envio e autenticação de credenciais da Shopify.
 */
export interface ShopifyCredentialsPayload {
  /** Domínio myshopify.com da loja (ex: "minhaloja.myshopify.com") */
  store_domain: string;
  /** Token de acesso do Admin API (shpat_...) */
  admin_access_token: string;
}

/**
 * Objeto de representação de uma loja/integração cadastrada para o tenant.
 */
export interface StoreIntegration {
  /** ID único da integração */
  id: string;
  /** Identificador do tenant proprietário */
  tenant_id: string;
  /** Plataforma da loja (Shopify, Nuvemshop ou WooCommerce) */
  platform: PlatformType;
  /** Domínio ou URL da loja cadastrada */
  store_domain?: string;
  /** Status da conexão com a API da loja */
  status: ConnectionStatus;
  /** Mensagem ou rótulo do último teste de saúde */
  health_check_status?: string;
  /** Latência em milissegundos do último teste de resposta da API */
  health_check_latency_ms?: number;
  /** Data e hora de criação da integração (ISO 8601) */
  created_at: string;
}

/**
 * Resposta retornada após a execução de um teste de conexão/saúde (Health Check).
 */
export interface HealthCheckResponse {
  /** Indica se a conexão com a API da loja foi bem-sucedida */
  success: boolean;
  /** Mensagem descritiva do resultado da checagem */
  message: string;
  /** Latência medida da resposta da API em milissegundos */
  latency_ms: number;
}
