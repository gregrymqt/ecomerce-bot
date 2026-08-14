import { useState, useCallback } from 'react';
import { productService } from '../services/product.service';
import type { NuvemshopVisibility } from '@/features/integrations';

export type PlatformTarget = 'SHOPIFY' | 'NUVEMSHOP' | 'ALL';

export interface BulkSyncOptions {
  platform: PlatformTarget;
  skus: string[];
  forceUpdate?: boolean;
  nuvemshopVisibility?: NuvemshopVisibility;
}

export interface BulkSyncResult {
  success: boolean;
  platform: PlatformTarget;
  message: string;
  jobId?: string;
  details?: Record<string, unknown>;
}

export function useBulkPlatformSync() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<BulkSyncResult | null>(null);

  const executeBulkSync = useCallback(async (options: BulkSyncOptions): Promise<BulkSyncResult> => {
    const { platform, skus, forceUpdate = true, nuvemshopVisibility = 'visible' } = options;

    if (!skus || skus.length === 0) {
      const errMessage = 'Selecione ao menos um produto para sincronizar.';
      setSyncError(errMessage);
      return { success: false, platform, message: errMessage };
    }

    setIsSyncing(true);
    setSyncError(null);
    setLastResult(null);

    try {
      const results: string[] = [];
      let jobId: string | undefined = undefined;

      // Sincronização Shopify Bulk API
      if (platform === 'SHOPIFY' || platform === 'ALL') {
        const shopifyRes = await productService.bulkSyncToShopify(skus);
        results.push(`Shopify: ${shopifyRes.message || 'Sincronização iniciada'}`);
      }

      // Sincronização Nuvemshop via RabbitMQ Worker Queue
      if (platform === 'NUVEMSHOP' || platform === 'ALL') {
        const nuvemRes = await productService.bulkSyncToNuvemshop({
          skus,
          force_update: forceUpdate,
          visibility: nuvemshopVisibility,
        });
        jobId = nuvemRes.job_id;
        results.push(`Nuvemshop: ${nuvemRes.total_enqueued} produtos enfileirados (Job ID: ${nuvemRes.job_id.slice(0, 8)})`);
      }

      const finalResult: BulkSyncResult = {
        success: true,
        platform,
        message: results.join(' | '),
        jobId,
      };

      setLastResult(finalResult);
      return finalResult;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Falha ao executar a sincronização em lote.';
      setSyncError(message);
      const errorResult: BulkSyncResult = {
        success: false,
        platform,
        message,
      };
      setLastResult(errorResult);
      return errorResult;
    } finally {
      setIsSyncing(false);
    }
  }, []);

  return {
    isSyncing,
    syncError,
    setSyncError,
    lastResult,
    executeBulkSync,
  };
}
