/**
 * src/features/catalog/services/product.service.ts
 *
 * Serviço de comunicação HTTP com a Core API (.NET 9) para Produtos e Sincronização.
 */

import { apiClient } from '@/lib/apiClient';
import { getErrorMessage } from '@/utils/errors';
import type {
  Product,
  ProductFilterParams,
  PaginatedProductsResponse,
  ProductUpdatePayload,
  SyncProductResponse,
} from '../types';
import type {
  ShopifySyncRequest,
  ShopifyProductResponse,
  NuvemshopBulkSyncRequest,
  NuvemshopBulkSyncResponse,
} from '@/features/integrations';

export const productService = {
  /**
   * Busca lista paginada de produtos com suporte a filtro por status e busca por título/SKU.
   */
  getProducts: async (params?: ProductFilterParams): Promise<PaginatedProductsResponse> => {
    try {
      const response = await apiClient.get<PaginatedProductsResponse>('/api/v1/products', {
        params: {
          status: params?.status || undefined,
          search: params?.search || undefined,
          page: params?.page || 1,
          limit: params?.limit || 20,
        },
      });
      return response.data;
    } catch (error: unknown) {
      const message = getErrorMessage(error, 'Erro ao carregar catálogo de produtos.');
      throw new Error(message);
    }
  },

  /**
   * Atualiza dados de um produto existente pelo SKU.
   */
  updateProduct: async (sku: string, payload: ProductUpdatePayload): Promise<Product> => {
    try {
      const response = await apiClient.patch<Product>(`/api/v1/products/${sku}`, payload);
      return response.data;
    } catch (error: unknown) {
      const message = getErrorMessage(error, 'Erro ao atualizar informações do produto.');
      throw new Error(message);
    }
  },

  /**
   * Remove um produto pelo SKU.
   */
  deleteProduct: async (sku: string): Promise<{ status: string; message: string }> => {
    try {
      const response = await apiClient.delete<{ status: string; message: string }>(`/api/v1/products/${sku}`);
      return response.data;
    } catch (error: unknown) {
      const message = getErrorMessage(error, 'Erro ao remover o produto do catálogo.');
      throw new Error(message);
    }
  },

  /**
   * Sincroniza produto diretamente para a Shopify via GraphQL no backend.
   */
  syncToShopify: async (productPayload: ShopifySyncRequest | Record<string, unknown>): Promise<ShopifyProductResponse> => {
    try {
      const response = await apiClient.post<ShopifyProductResponse>('/api/v1/shopify/products', productPayload);
      return response.data;
    } catch (error: unknown) {
      const message = getErrorMessage(error, 'Erro ao sincronizar produto com a Shopify.');
      throw new Error(message);
    }
  },

  /**
   * Inicia a sincronização assíncrona em lote de produtos para a Shopify via Bulk API GraphQL.
   * Endpoint: POST /api/v1/shopify/products/bulk-sync
   */
  bulkSyncToShopify: async (skus: string[]): Promise<SyncProductResponse> => {
    try {
      const response = await apiClient.post<SyncProductResponse>('/api/v1/shopify/products/bulk-sync', {
        skus,
      });
      return response.data;
    } catch (error: unknown) {
      const message = getErrorMessage(error, 'Erro ao iniciar sincronização em lote na Shopify.');
      throw new Error(message);
    }
  },

  /**
   * Sincroniza produto diretamente para a Nuvemshop via API REST no backend.
   */
  syncToNuvemshop: async (productPayload: Record<string, unknown>): Promise<SyncProductResponse> => {
    try {
      const response = await apiClient.post<SyncProductResponse>('/api/v1/nuvemshop/products', productPayload);
      return response.data;
    } catch (error: unknown) {
      const message = getErrorMessage(error, 'Erro ao sincronizar produto com a Nuvemshop.');
      throw new Error(message);
    }
  },

  /**
   * Inicia a sincronização assíncrona em lote de produtos para a Nuvemshop via RabbitMQ.
   * Endpoint: POST /api/v1/nuvemshop/products/bulk-sync (202 Accepted)
   */
  bulkSyncToNuvemshop: async (payload: NuvemshopBulkSyncRequest): Promise<NuvemshopBulkSyncResponse> => {
    try {
      const response = await apiClient.post<NuvemshopBulkSyncResponse>('/api/v1/nuvemshop/products/bulk-sync', payload);
      return response.data;
    } catch (error: unknown) {
      const message = getErrorMessage(error, 'Erro ao enfileirar sincronização em lote na Nuvemshop.');
      throw new Error(message);
    }
  },
};

export default productService;
