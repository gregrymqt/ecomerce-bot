/**
 * src/features/integrations/hooks/useShopifyIntegration.ts
 *
 * Hook especializado para mutações atômicas da Shopify (estoque, status e credenciais).
 */

import { useState, useCallback } from 'react';
import { integrationService } from '../services/integration.service';
import type {
  ShopifyInventoryUpdateInput,
  ShopifyProductStatus,
  ShopifyProductResponse,
  StoreIntegration,
  ShopifyCredentialsPayload,
} from '../types';
import { getErrorMessage } from '@/utils/errors';

export function useShopifyIntegration() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Salva credenciais estáticas do Admin API da Shopify.
   */
  const saveCredentials = useCallback(
    async (payload: ShopifyCredentialsPayload): Promise<StoreIntegration | null> => {
      setIsSubmitting(true);
      setError(null);
      try {
        const result = await integrationService.saveShopifyCredentials(payload);
        return result;
      } catch (err: unknown) {
        const message = getErrorMessage(err, 'Erro ao salvar credenciais Shopify.');
        setError(message);
        return null;
      } finally {
        setIsSubmitting(false);
      }
    },
    []
  );

  /**
   * Inicia o fluxo de autorização OAuth 2.0 da Shopify redirecionando o usuário.
   */
  const initiateOAuth = useCallback(async (shopDomain: string): Promise<boolean> => {
    setIsSubmitting(true);
    setError(null);
    try {
      const response = await integrationService.initiateShopifyOAuth(shopDomain);
      if (response.authorize_url) {
        window.location.href = response.authorize_url;
        return true;
      }
      throw new Error('URL de autorização não retornada pelo servidor.');
    } catch (err: unknown) {
      const message = getErrorMessage(err, 'Erro ao iniciar OAuth da Shopify.');
      setError(message);
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  /**
   * Atualiza o estoque de um SKU na Shopify.
   */
  const updateInventory = useCallback(
    async (sku: string, payload: ShopifyInventoryUpdateInput): Promise<ShopifyProductResponse | null> => {
      setIsSubmitting(true);
      setError(null);
      try {
        const result = await integrationService.updateShopifyInventory(sku, payload);
        return result;
      } catch (err: unknown) {
        const message = getErrorMessage(err, 'Erro ao atualizar estoque na Shopify.');
        setError(message);
        return null;
      } finally {
        setIsSubmitting(false);
      }
    },
    []
  );

  /**
   * Atualiza o status do produto na Shopify (ACTIVE, DRAFT, ARCHIVED).
   */
  const updateStatus = useCallback(
    async (sku: string, status: ShopifyProductStatus): Promise<ShopifyProductResponse | null> => {
      setIsSubmitting(true);
      setError(null);
      try {
        const result = await integrationService.updateShopifyStatus(sku, status);
        return result;
      } catch (err: unknown) {
        const message = getErrorMessage(err, 'Erro ao alterar status na Shopify.');
        setError(message);
        return null;
      } finally {
        setIsSubmitting(false);
      }
    },
    []
  );

  return {
    isSubmitting,
    error,
    setError,
    saveCredentials,
    initiateOAuth,
    updateInventory,
    updateStatus,
  };
}

export default useShopifyIntegration;
