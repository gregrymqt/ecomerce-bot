import { useState } from 'react';
import type{
  NuvemshopProductRequest,
  NuvemshopProductUpdatePayload,
  NuvemshopBatchStockPriceItem,
  NuvemshopSyncResponse,
} from '../types/nuvemshop.type';
import { nuvemshopService } from '../services/nuvemshop.service';
import { getErrorMessage } from '@/utils/errors';

export function useNuvemshop() {
  const [loading, setLoading] = useState(false);
  const [syncingSku, setSyncingSku] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [credentialsMissing, setCredentialsMissing] = useState(false);
  const [forbiddenScope, setForbiddenScope] = useState(false);

  /**
   * Dispara a sincronização de um produto com a Nuvemshop
   */
  const syncProduct = async (payload: NuvemshopProductRequest): Promise<NuvemshopSyncResponse> => {
    setSyncingSku(payload.variants[0]?.sku || 'produto');
    setError(null);
    setCredentialsMissing(false);
    setForbiddenScope(false);

    try {
      const result = await nuvemshopService.createProduct(payload);
      return result;
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 412) {
        setCredentialsMissing(true);
        throw new Error('Credenciais da Nuvemshop não configuradas no Tenant.');
      }
      if (status === 403) {
        setForbiddenScope(true);
        throw new Error('O token informado não possui permissão de escrita (write_products) na Nuvemshop.');
      }
      const msg = getErrorMessage(err, 'Erro ao sincronizar produto com a Nuvemshop.');
      setError(msg);
      throw new Error(msg);
    } finally {
      setSyncingSku(null);
    }
  };

  /**
   * Atualiza metadados do produto remoto
   */
  const updateMetadata = async (productId: number, payload: NuvemshopProductUpdatePayload) => {
    setLoading(true);
    setError(null);
    try {
      return await nuvemshopService.updateProductMetadata(productId, payload);
    } catch (err) {
      const msg = getErrorMessage(err, 'Erro ao atualizar metadados na Nuvemshop.');
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Atualização em lote de estoque/preço
   */
  const updateStockPriceBatch = async (batch: NuvemshopBatchStockPriceItem[]) => {
    setLoading(true);
    setError(null);
    try {
      return await nuvemshopService.updateStockPriceBatch(batch);
    } catch (err) {
      const msg = getErrorMessage(err, 'Erro no ajuste de estoque/preço em lote.');
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Exclusão do produto remoto
   */
  const deleteProduct = async (productId: number) => {
    setLoading(true);
    setError(null);
    try {
      await nuvemshopService.deleteProduct(productId);
    } catch (err) {
      const msg = getErrorMessage(err, 'Erro ao remover produto da Nuvemshop.');
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    syncingSku,
    error,
    credentialsMissing,
    forbiddenScope,
    syncProduct,
    updateMetadata,
    updateStockPriceBatch,
    deleteProduct,
  };
}