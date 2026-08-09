import { apiClient } from '@/lib/apiClient';
import type {
  Product,
  ProductFilterParams,
  PaginatedProductsResponse,
  ProductUpdatePayload,
} from '@/features/catalog';

export const productService = {
  /**
   * Busca lista paginada de produtos com suporte a filtro por status e busca por título/SKU.
   */
  getProducts: async (params?: ProductFilterParams): Promise<PaginatedProductsResponse> => {
    const response = await apiClient.get<PaginatedProductsResponse>('/api/v1/products', {
      params: {
        status: params?.status || undefined,
        search: params?.search || undefined,
        page: params?.page || 1,
        limit: params?.limit || 20,
      },
    });
    return response.data;
  },

  /**
   * Atualiza dados de um produto existente pelo SKU.
   */
  updateProduct: async (sku: string, payload: ProductUpdatePayload): Promise<Product> => {
    const response = await apiClient.patch<Product>(`/api/v1/products/${sku}`, payload);
    return response.data;
  },

  /**
   * Remove um produto pelo SKU.
   */
  deleteProduct: async (sku: string): Promise<{ status: string; message: string }> => {
    const response = await apiClient.delete<{ status: string; message: string }>(`/api/v1/products/${sku}`);
    return response.data;
  },

  /**
   * Sincroniza produto diretamente para a Shopify via GraphQL no backend.
   */
  syncToShopify: async (productPayload: Record<string, unknown>): Promise<Record<string, unknown>> => {
    const response = await apiClient.post<Record<string, unknown>>('/api/v1/shopify/products', productPayload);
    return response.data;
  },

  /**
   * Sincroniza produto diretamente para a Nuvemshop via API REST no backend.
   */
  syncToNuvemshop: async (productPayload: Record<string, unknown>): Promise<Record<string, unknown>> => {
    const response = await apiClient.post<Record<string, unknown>>('/api/v1/nuvemshop/products', productPayload);
    return response.data;
  },
};
