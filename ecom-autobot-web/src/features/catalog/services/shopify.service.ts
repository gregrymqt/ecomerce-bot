import { apiClient } from '@/lib/apiClient';
import type {
  ShopifySyncProductPayload,
  ShopifySyncResponse,
  ShopifyMediaAddPayload,
  ShopifyProductUpdatePayload,
  ShopifyProductListResponse,
} from '../types/shopify.type';

export const shopifyService = {
  /**
   * Sincroniza um produto com a loja Shopify via GraphQL.
   * Suporta HTTP 202 com resposta de fallback CSV.
   */
  syncProduct: async (productData: ShopifySyncProductPayload): Promise<ShopifySyncResponse> => {
    const response = await apiClient.post<ShopifySyncResponse>(
      '/api/v1/shopify/products',
      productData
    );
    return response.data;
  },

  /**
   * Associa mídias/imagens a um produto existente no Shopify por GID.
   */
  addMediaToProduct: async (productId: string, payload: ShopifyMediaAddPayload) => {
    const encodedId = encodeURIComponent(productId);
    const response = await apiClient.post(
      `/api/v1/shopify/products/${encodedId}/media`,
      payload
    );
    return response.data;
  },

  /**
   * Atualiza dados e SEO de um produto no Shopify.
   */
  updateProduct: async (productId: string, payload: ShopifyProductUpdatePayload) => {
    const encodedId = encodeURIComponent(productId);
    const response = await apiClient.put(
      `/api/v1/shopify/products/${encodedId}`,
      payload
    );
    return response.data;
  },

  /**
   * Deleta um produto diretamente da loja Shopify.
   */
  deleteProduct: async (productId: string) => {
    const encodedId = encodeURIComponent(productId);
    await apiClient.delete(`/api/v1/shopify/products/${encodedId}`);
  },

  /**
   * Lista os produtos diretamente do catálogo remoto da Shopify usando cursores.
   */
  listProducts: async (first: number = 10, after?: string | null): Promise<ShopifyProductListResponse> => {
    const response = await apiClient.get<ShopifyProductListResponse>('/api/v1/shopify/products', {
      params: {
        first,
        after: after || undefined,
      },
    });
    return response.data;
  },
};