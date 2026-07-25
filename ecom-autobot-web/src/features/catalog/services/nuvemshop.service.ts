import { apiClient } from '@/lib/apiClient';
import type {
  NuvemshopProductRequest,
  NuvemshopProductUpdatePayload,
  NuvemshopBatchStockPriceItem,
  NuvemshopSyncResponse,
} from '../types/nuvemshop.type';

export const nuvemshopService = {
  /**
   * Envia um produto para criação na Nuvemshop.
   * Suporta resposta HTTP 202 com URL para download do Fallback CSV.
   */
  createProduct: async (payload: NuvemshopProductRequest): Promise<NuvemshopSyncResponse> => {
    const response = await apiClient.post<NuvemshopSyncResponse>(
      '/api/v1/nuvemshop/products',
      payload
    );
    return response.data;
  },

  /**
   * Busca um produto cadastrado na Nuvemshop pelo ID interno da loja.
   */
  getProductById: async (productId: number): Promise<any> => {
    const response = await apiClient.get(`/api/v1/nuvemshop/products/${productId}`);
    return response.data;
  },

  /**
   * Busca um produto cadastrado na Nuvemshop pelo código SKU.
   */
  getProductBySku: async (sku: string): Promise<any> => {
    const response = await apiClient.get(`/api/v1/nuvemshop/products/sku/${encodeURIComponent(sku)}`);
    return response.data;
  },

  /**
   * Atualiza título, descrição, slug e marcas do produto na Nuvemshop.
   */
  updateProductMetadata: async (productId: number, payload: NuvemshopProductUpdatePayload): Promise<any> => {
    const response = await apiClient.put(
      `/api/v1/nuvemshop/products/${productId}`,
      payload
    );
    return response.data;
  },

  /**
   * Executa atualização rápida em lote para estoque e preço (máximo 50 itens).
   */
  updateStockPriceBatch: async (batchData: NuvemshopBatchStockPriceItem[]): Promise<any[]> => {
    const response = await apiClient.patch<any[]>(
      '/api/v1/nuvemshop/products/stock-price',
      batchData
    );
    return response.data;
  },

  /**
   * Remove um produto da loja Nuvemshop por ID.
   */
  deleteProduct: async (productId: number): Promise<void> => {
    await apiClient.delete(`/api/v1/nuvemshop/products/${productId}`);
  },
};