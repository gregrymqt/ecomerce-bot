import { useState, useCallback } from 'react';
import type {
  ShopifySyncProductPayload,
  ShopifySyncResponse,
  ShopifyEdge,
  ShopifyPageInfo,
  ShopifyProductUpdatePayload,
} from '../types/shopify.type';
import { shopifyService } from '../services/shopify.service';
import { getErrorMessage } from '@/utils/errors';

export function useShopify() {
  const [remoteProducts, setRemoteProducts] = useState<ShopifyEdge[]>([]);
  const [pageInfo, setPageInfo] = useState<ShopifyPageInfo>({ hasNextPage: false, endCursor: null });
  const [loading, setLoading] = useState(false);
  const [syncingSku, setSyncingSku] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [credentialsMissing, setCredentialsMissing] = useState(false);

  /**
   * Busca a lista de produtos diretamente da API da Shopify
   */
  const fetchRemoteProducts = useCallback(async (afterCursor?: string | null) => {
    setLoading(true);
    setError(null);
    setCredentialsMissing(false);
    try {
      const data = await shopifyService.listProducts(10, afterCursor);
      setRemoteProducts(data.edges || []);
      setPageInfo(data.pageInfo || { hasNextPage: false, endCursor: null });
    } catch (err: any) {
      if (err?.response?.status === 412) {
        setCredentialsMissing(true);
      } else {
        setError(getErrorMessage(err, 'Falha ao buscar produtos da Shopify.'));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Sincroniza um produto do catálogo local com a Shopify
   */
  const syncProduct = async (productData: ShopifySyncProductPayload): Promise<ShopifySyncResponse> => {
    setSyncingSku(productData.sku);
    setError(null);
    try {
      const result = await shopifyService.syncProduct(productData);
      return result;
    } catch (err: any) {
      if (err?.response?.status === 412) {
        setCredentialsMissing(true);
        throw new Error('As credenciais da Shopify não foram configuradas no seu Tenant.');
      }
      const msg = getErrorMessage(err, 'Erro ao sincronizar produto com a Shopify.');
      setError(msg);
      throw new Error(msg);
    } finally {
      setSyncingSku(null);
    }
  };

  /**
   * Atualiza um produto remoto na Shopify
   */
  const updateProduct = async (productId: string, payload: ShopifyProductUpdatePayload) => {
    setLoading(true);
    try {
      await shopifyService.updateProduct(productId, payload);
      await fetchRemoteProducts();
    } catch (err) {
      throw new Error(getErrorMessage(err, 'Erro ao atualizar produto na Shopify.'));
    } finally {
      setLoading(false);
    }
  };

  /**
   * Remove um produto da loja Shopify
   */
  const deleteProduct = async (productId: string) => {
    setLoading(true);
    try {
      await shopifyService.deleteProduct(productId);
      setRemoteProducts((prev) => prev.filter((item) => item.node.id !== productId));
    } catch (err) {
      throw new Error(getErrorMessage(err, 'Erro ao deletar produto da Shopify.'));
    } finally {
      setLoading(false);
    }
  };

  return {
    remoteProducts,
    pageInfo,
    loading,
    syncingSku,
    error,
    credentialsMissing,
    fetchRemoteProducts,
    syncProduct,
    updateProduct,
    deleteProduct,
  };
}