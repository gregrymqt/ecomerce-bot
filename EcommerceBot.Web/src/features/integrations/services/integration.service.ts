/**
 * src/features/integrations/services/integration.service.ts
 *
 * Camada de serviços HTTP para consumo dos endpoints de Integrações com plataformas de e-commerce.
 * Integrado com o apiClient do projeto e tipado com os DTOs de integração (Shopify e Nuvemshop).
 */

import { apiClient } from '@/lib/apiClient';
import { getErrorMessage } from '@/utils/errors';
import type {
  HealthCheckResponse,
  IntegrationSummary,
  ShopifyCredentialsPayload,
  ShopifyInventoryUpdateInput,
  ShopifyProductStatus,
  ShopifyProductResponse,
  StoreIntegration,
  NuvemshopBatchStockPriceItem,
  NuvemshopBatchStockPriceResponse,
  NuvemshopCategory,
} from '@/features/integrations';

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
   * Inicia o fluxo de autorização OAuth 2.0 com a Shopify.
   * Endpoint: GET /api/v1/shopify/auth?shop={shopDomain}
   */
  initiateShopifyOAuth: async (shopDomain: string): Promise<{ authorize_url: string }> => {
    try {
      const response = await apiClient.get<{ authorize_url: string }>(
        `/api/v1/shopify/auth?shop=${encodeURIComponent(shopDomain)}`
      );
      return response.data;
    } catch (error: unknown) {
      const message = getErrorMessage(
        error,
        'Falha ao iniciar autorização OAuth com a Shopify.'
      );
      throw new Error(message);
    }
  },

  /**
   * Atualização rápida de saldo em estoque de produto na Shopify por SKU.
   * Endpoint: PATCH /api/v1/shopify/products/{sku}/inventory
   */
  updateShopifyInventory: async (
    sku: string,
    payload: ShopifyInventoryUpdateInput
  ): Promise<ShopifyProductResponse> => {
    try {
      const response = await apiClient.patch<ShopifyProductResponse>(
        `/api/v1/shopify/products/${encodeURIComponent(sku)}/inventory`,
        payload
      );
      return response.data;
    } catch (error: unknown) {
      const message = getErrorMessage(
        error,
        'Erro ao atualizar estoque na Shopify.'
      );
      throw new Error(message);
    }
  },

  /**
   * Alteração de status do produto na Shopify (ACTIVE, DRAFT, ARCHIVED).
   * Endpoint: PATCH /api/v1/shopify/products/{sku}/status
   */
  updateShopifyStatus: async (
    sku: string,
    status: ShopifyProductStatus
  ): Promise<ShopifyProductResponse> => {
    try {
      const response = await apiClient.patch<ShopifyProductResponse>(
        `/api/v1/shopify/products/${encodeURIComponent(sku)}/status`,
        { status }
      );
      return response.data;
    } catch (error: unknown) {
      const message = getErrorMessage(
        error,
        'Erro ao atualizar status do produto na Shopify.'
      );
      throw new Error(message);
    }
  },

  /**
   * Remoção remota de um produto na Shopify pelo SKU.
   * Endpoint: DELETE /api/v1/shopify/products/{sku}
   */
  deleteShopifyRemoteProduct: async (sku: string): Promise<ShopifyProductResponse> => {
    try {
      const response = await apiClient.delete<ShopifyProductResponse>(
        `/api/v1/shopify/products/${encodeURIComponent(sku)}`
      );
      return response.data;
    } catch (error: unknown) {
      const message = getErrorMessage(
        error,
        'Erro ao remover produto remoto na Shopify.'
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
   * Salva e valida as credenciais manuais (Store ID & Access Token) da Nuvemshop.
   * Endpoint: POST /api/v1/nuvemshop/credentials
   */
  saveNuvemshopCredentials: async (payload: {
    store_id: string;
    access_token: string;
  }): Promise<{ success: boolean; message: string }> => {
    try {
      const response = await apiClient.post<{ success: boolean; message: string }>(
        '/api/v1/nuvemshop/credentials',
        payload
      );
      return response.data;
    } catch (error: unknown) {
      const message = getErrorMessage(
        error,
        'Falha ao salvar as credenciais da Nuvemshop. Verifique o Store ID e o Access Token.'
      );
      throw new Error(message);
    }
  },

  /**
   * Obtém a URL de autorização OAuth para integração com a Nuvemshop.
   * Endpoint: GET /api/v1/nuvemshop/auth
   */
  getNuvemshopOAuthUrl: async (): Promise<{ url: string }> => {
    try {
      const response = await apiClient.get<{ url: string }>('/api/v1/nuvemshop/auth');
      return response.data;
    } catch (error: unknown) {
      const message = getErrorMessage(
        error,
        'Erro ao gerar URL de autorização OAuth da Nuvemshop.'
      );
      throw new Error(message);
    }
  },

  /**
   * Lista todas as categorias cadastradas na loja da Nuvemshop.
   * Endpoint: GET /api/v1/nuvemshop/categories
   */
  getNuvemshopCategories: async (): Promise<NuvemshopCategory[]> => {
    try {
      const response = await apiClient.get<NuvemshopCategory[]>(
        '/api/v1/nuvemshop/categories'
      );
      return response.data;
    } catch (error: unknown) {
      const message = getErrorMessage(
        error,
        'Erro ao buscar categorias na Nuvemshop.'
      );
      throw new Error(message);
    }
  },

  /**
   * Atualização rápida em lote de saldo em estoque e preços na Nuvemshop.
   * Endpoint: PATCH /api/v1/nuvemshop/products/stock-price
   */
  updateNuvemshopStockPriceBatch: async (
    items: NuvemshopBatchStockPriceItem[]
  ): Promise<NuvemshopBatchStockPriceResponse> => {
    try {
      const response = await apiClient.patch<NuvemshopBatchStockPriceResponse>(
        '/api/v1/nuvemshop/products/stock-price',
        items
      );
      return response.data;
    } catch (error: unknown) {
      const message = getErrorMessage(
        error,
        'Erro ao atualizar lote de preços/estoque na Nuvemshop.'
      );
      throw new Error(message);
    }
  },
};
