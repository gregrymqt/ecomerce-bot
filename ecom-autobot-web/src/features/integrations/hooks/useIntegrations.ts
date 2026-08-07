/**
 * src/features/integrations/hooks/useIntegrations.ts
 *
 * Custom Hook reativo para gerenciamento do estado e operações da Central de Integrações.
 * Controla carregamento em paralelo (resumo e lista), salvamento de credenciais Shopify,
 * testes de saúde da API de cada loja, remoção de integrações e fluxo OAuth Nuvemshop.
 */

import { useState, useEffect, useCallback } from 'react';
import { integrationService } from '../services/integration.service';
import type {
  HealthCheckResponse,
  IntegrationSummary,
  ShopifyCredentialsPayload,
  StoreIntegration,
} from '../types/integration.type';
import { getErrorMessage } from '@/utils/errors';

export function useIntegrations() {
  // 1. Estados Reativos Principais
  const [summary, setSummary] = useState<IntegrationSummary | null>(null);
  const [integrations, setIntegrations] = useState<StoreIntegration[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [isShopifyModalOpen, setIsShopifyModalOpen] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Auxiliar para manipular o estado de loading de ações individuais por chave
  const setActionState = (key: string, isLoading: boolean) => {
    setActionLoading((prev) => ({ ...prev, [key]: isLoading }));
  };

  // 2. Carregamento em paralelo dos dados iniciais (Resumo e Lista de Lojas)
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [summaryRes, integrationsRes] = await Promise.all([
        integrationService.getSummary(),
        integrationService.listIntegrations(),
      ]);
      setSummary(summaryRes);
      setIntegrations(integrationsRes);
    } catch (err: unknown) {
      const message = getErrorMessage(err, 'Erro ao carregar dados das integrações.');
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Disparo automático na montagem
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 3. Salvar Credenciais da Shopify
  const handleSaveShopify = useCallback(
    async (payload: ShopifyCredentialsPayload): Promise<boolean> => {
      setActionState('save_shopify', true);
      setError(null);
      setSuccessMessage(null);
      try {
        await integrationService.saveShopifyCredentials(payload);
        setIsShopifyModalOpen(false);
        setSuccessMessage('Loja Shopify conectada com sucesso!');
        await fetchData();
        return true;
      } catch (err: unknown) {
        const message = getErrorMessage(err, 'Erro ao salvar credenciais Shopify.');
        setError(message);
        return false;
      } finally {
        setActionState('save_shopify', false);
      }
    },
    [fetchData]
  );

  // 4. Testar Conexão / Health Check de uma loja específica
  const handleTestConnection = useCallback(
    async (integrationId: string): Promise<HealthCheckResponse | null> => {
      const actionKey = `test_${integrationId}`;
      setActionState(actionKey, true);
      setError(null);
      try {
        const res = await integrationService.testConnection(integrationId);

        // Atualiza dinamicamente o estado local da loja na lista
        setIntegrations((prev) =>
          prev.map((store) =>
            store.id === integrationId
              ? {
                  ...store,
                  status: res.success ? 'CONNECTED' : 'ERROR',
                  health_check_status: res.message,
                  health_check_latency_ms: res.latency_ms,
                }
              : store
          )
        );

        return res;
      } catch (err: unknown) {
        const message = getErrorMessage(err, 'Erro ao testar conexão.');
        setError(message);
        return null;
      } finally {
        setActionState(actionKey, false);
      }
    },
    []
  );

  // 5. Desconectar / Remover uma integração de loja
  const handleDisconnect = useCallback(
    async (integrationId: string): Promise<boolean> => {
      const confirmed = window.confirm(
        'Tem certeza que deseja desconectar esta loja? A sincronização de produtos será interrompida.'
      );
      if (!confirmed) return false;

      const actionKey = `disconnect_${integrationId}`;
      setActionState(actionKey, true);
      setError(null);
      try {
        await integrationService.disconnectStore(integrationId);
        setSuccessMessage('Loja desconectada com sucesso.');
        await fetchData();
        return true;
      } catch (err: unknown) {
        const message = getErrorMessage(err, 'Erro ao desconectar a loja.');
        setError(message);
        return false;
      } finally {
        setActionState(actionKey, false);
      }
    },
    [fetchData]
  );

  // 6. Iniciar Fluxo OAuth da Nuvemshop (redirecionamento de página)
  const handleConnectNuvemshop = useCallback(async (): Promise<void> => {
    setActionState('connect_nuvemshop', true);
    setError(null);
    try {
      const res = await integrationService.getNuvemshopOAuthUrl();
      if (res.oauth_url) {
        window.location.href = res.oauth_url;
      } else {
        throw new Error('URL de autorização OAuth da Nuvemshop inválida.');
      }
    } catch (err: unknown) {
      const message = getErrorMessage(err, 'Erro ao iniciar autorização Nuvemshop.');
      setError(message);
    } finally {
      setActionState('connect_nuvemshop', false);
    }
  }, []);

  return {
    // Estados
    summary,
    integrations,
    loading,
    actionLoading,
    isShopifyModalOpen,
    setIsShopifyModalOpen,
    error,
    setError,
    successMessage,
    setSuccessMessage,

    // Handlers
    fetchData,
    handleSaveShopify,
    handleTestConnection,
    handleDisconnect,
    handleConnectNuvemshop,
  };
}
