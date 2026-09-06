/**
 * src/features/catalog/hooks/useProductSync.ts
 *
 * Hook especializado para orquestrar a sincronização individual de produtos
 * com plataformas externas (Shopify via GraphQL e Nuvemshop via REST).
 */

import { useState, useCallback } from 'react';
import { productService } from '../services/product.service';
import type { CatalogProduct, SyncProductResponse } from '../types';
import { getErrorMessage } from '@/utils/errors';

export interface UseProductSyncOptions {
  onSyncSuccess?: (
    product: CatalogProduct,
    isFallback: boolean,
    message: string,
    downloadUrl?: string
  ) => void;
  onSyncError?: (product: CatalogProduct, errorDetail: string) => void;
}

export function useProductSync(options: UseProductSyncOptions = {}) {
  const [syncingSku, setSyncingSku] = useState<string | null>(null);

  const syncProduct = useCallback(
    async (product: CatalogProduct): Promise<boolean> => {
      setSyncingSku(product.sku);
      try {
        const payload = {
          sku: product.sku,
          title: product.titleAi || product.titleOriginal,
          description: product.descriptionAi,
          images: product.thumbnailUrl ? [product.thumbnailUrl] : [],
        };

        const res =
          product.platform === 'Nuvemshop'
            ? await productService.syncToNuvemshop(payload)
            : await productService.syncToShopify(payload);

        const syncRes = res as SyncProductResponse;
        const isFallback = syncRes.status === 'fallback_csv';
        const reasonText =
          syncRes.reason ||
          syncRes.error_detail ||
          syncRes.message ||
          'Falha de comunicação com a plataforma externa.';
        const message = isFallback
          ? `A API da ${product.platform} retornou uma falha (${reasonText}). O arquivo CSV com a copywriting de IA foi gerado como alternativa. Acesse ${syncRes.download_url || '/api/v1/export'} para baixar.`
          : `O produto SKU ${product.sku} foi sincronizado com sucesso na ${product.platform}.`;

        options.onSyncSuccess?.(product, isFallback, message, syncRes.download_url);
        return true;
      } catch (err: unknown) {
        const errorDetail = getErrorMessage(err, 'Erro desconhecido de sincronização.');
        options.onSyncError?.(product, errorDetail);
        return false;
      } finally {
        setSyncingSku(null);
      }
    },
    [options]
  );

  return {
    syncingSku,
    syncProduct,
  };
}

export default useProductSync;
