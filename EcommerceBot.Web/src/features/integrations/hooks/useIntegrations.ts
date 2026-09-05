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
} from '../types';
import { getErrorMessage } from '@/utils/errors';

export function useIntegrations() {
  // 1. Estados Reativos Principais
  const [summary, setSummary] = useState<IntegrationSummary | null>(null);
  const [integrations, setIntegrations] = useState<StoreIntegration[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [isShopifyModalOpen, setIsShopifyModalOpen] = useState<boolean>(false);
  const [isNuvemshopModalOpen, setIsNuvemshopModalOpen] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Auxiliar para manipular o estado de loading de ações individuais por chave
  const setActionState = (key: string, isLoading: boolean) => {
    setActionLoading((prev) => ({ ...prev, [key]: isLoading }));
  };

  // 2. Carregamento em paralelo dos dados iniciais (Resumo e Lista de Lojas)
  const fetchData = useCallback(async (isManualAction = false) => {
    if (isManualAction) {
      setLoading(true);
      setError(null);
    }
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
    let isCancelled = false;

    Promise.all([
      integrationService.getSummary(),
      integrationService.listIntegrations(),
    ])
      .then(([summaryRes, integrationsRes]) => {
        if (!isCancelled) {
          setSummary(summaryRes);
          setIntegrations(integrationsRes);
        }
      })
      .catch((err: unknown) => {
        if (!isCancelled) {
          setError(getErrorMessage(err, 'Erro ao carregar dados das integrações.'));
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, []);

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

  // 4. Salvar Credenciais da Nuvemshop (Manual)
  const handleSaveNuvemshop = useCallback(
    async (payload: { store_id: string; access_token: string }): Promise<boolean> => {
      setActionState('save_nuvemshop', true);
      setError(null);
      setSuccessMessage(null);
      try {
        await integrationService.saveNuvemshopCredentials(payload);
        setIsNuvemshopModalOpen(false);
        setSuccessMessage('Loja Nuvemshop conectada com sucesso!');
        await fetchData();
        return true;
      } catch (err: unknown) {
        const message = getErrorMessage(err, 'Erro ao salvar credenciais da Nuvemshop.');
        setError(message);
        return false;
      } finally {
        setActionState('save_nuvemshop', false);
      }
    },
    [fetchData]
  );

  // 5. Testar Conexão / Health Check de uma loja específica
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

  // 6. Desconectar / Remover uma integração de loja
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

  // 7. Iniciar Fluxo OAuth da Nuvemshop (redirecionamento de página)
  const handleConnectNuvemshop = useCallback(async (): Promise<void> => {
    setActionState('connect_nuvemshop', true);
    setError(null);
    try {
      const res = await integrationService.getNuvemshopOAuthUrl();
      if (res.url) {
        window.location.href = res.url;
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
    isNuvemshopModalOpen,
    setIsNuvemshopModalOpen,
    error,
    setError,
    successMessage,
    setSuccessMessage,

    // Handlers
    fetchData,
    handleSaveShopify,
    handleSaveNuvemshop,
    handleTestConnection,
    handleDisconnect,
    handleConnectNuvemshop,
  };
}

export default useIntegrations;
