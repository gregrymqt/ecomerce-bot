/**
 * src/features/integrations/services/integration.service.ts
 *
 * Camada de serviços HTTP para consumo dos endpoints de Integrações com plataformas de e-commerce.
 * Integrado com o apiClient do projeto e tipado com os DTOs de integração.
 */

import { apiClient } from '@/lib/apiClient';
import { getErrorMessage } from '@/utils/errors';
import type {
  HealthCheckResponse,
  IntegrationSummary,
  ShopifyCredentialsPayload,
  StoreIntegration,
} from '@/features/integrations/types/integration.type';

export const integrationService = {
  /**
   * Obtém o resumo consolidado de métricas e status das integrações do tenant.
   * Endpoint: GET /api/v1/integrations/summary
   */
  getSummary: async (): Promise<IntegrationSummary> => {
    try {
      const response = await apiClient.get<IntegrationSummary>('/api/v1/integrations/summary');
      return response.data;
    } catch (error: unknown) {
      const message = getErrorMessage(
        error,
        'Não foi possível carregar o resumo das integrações.'
      );
      throw new Error(message);
    }
  },

  /**
   * Lista todas as lojas/integrações cadastradas para o tenant.
   * Endpoint: GET /api/v1/integrations
   */
  listIntegrations: async (): Promise<StoreIntegration[]> => {
    try {
      const response = await apiClient.get<StoreIntegration[]>('/api/v1/integrations');
      return response.data;
    } catch (error: unknown) {
      const message = getErrorMessage(
        error,
        'Erro ao listar as integrações cadastradas.'
      );
      throw new Error(message);
    }
  },

  /**
   * Salva e valida as credenciais da Admin API da Shopify.
   * Endpoint: POST /api/v1/shopify/credentials
   */
  saveShopifyCredentials: async (
    payload: ShopifyCredentialsPayload
  ): Promise<StoreIntegration> => {
    try {
      const response = await apiClient.post<StoreIntegration>(
        '/api/v1/shopify/credentials',
        payload
      );
      return response.data;
    } catch (error: unknown) {
      const message = getErrorMessage(
        error,
        'Falha ao salvar as credenciais da Shopify. Verifique o domínio e o Admin Access Token.'
      );
      throw new Error(message);
    }
  },

  /**
   * Executa um teste de conexão e mede a latência com a API da loja.
   * Endpoint: POST /api/v1/integrations/{integrationId}/health-check
   */
  testConnection: async (integrationId: string): Promise<HealthCheckResponse> => {
    try {
      const response = await apiClient.post<HealthCheckResponse>(
        `/api/v1/integrations/${integrationId}/health-check`
      );
      return response.data;
    } catch (error: unknown) {
      const message = getErrorMessage(
        error,
        'Erro ao testar a conexão com a loja. Tente novamente em instantes.'
      );
      throw new Error(message);
    }
  },

  /**
   * Desconecta e remove uma integração de loja cadastrada.
   * Endpoint: DELETE /api/v1/integrations/{integrationId}
   */
  disconnectStore: async (integrationId: string): Promise<void> => {
    try {
      await apiClient.delete(`/api/v1/integrations/${integrationId}`);
    } catch (error: unknown) {
      const message = getErrorMessage(
        error,
        'Erro ao desconectar a loja. Verifique as permissões do tenant.'
      );
      throw new Error(message);
    }
  },

  /**
   * Obtém a URL de autorização OAuth para integração com a Nuvemshop.
   * Endpoint: GET /api/v1/nuvemshop/oauth/url
   */
  getNuvemshopOAuthUrl: async (): Promise<{ oauth_url: string }> => {
    try {
      const response = await apiClient.get<{ oauth_url: string }>(
        '/api/v1/nuvemshop/oauth/url'
      );
      return response.data;
    } catch (error: unknown) {
      const message = getErrorMessage(
        error,
        'Erro ao gerar URL de autorização OAuth da Nuvemshop.'
      );
      throw new Error(message);
    }
  },
};
