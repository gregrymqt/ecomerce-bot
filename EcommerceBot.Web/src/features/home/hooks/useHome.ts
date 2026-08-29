/**
 * src/features/home/hooks/useHome.ts
 *
 * Custom Hook reativo para orquestração da feature Home / Overview.
 * Conecta catálogo, autenticação, integrações e telemetria com estado unificado.
 */

import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth';
import { useProducts } from '@/features/catalog';
import { integrationService, type StoreIntegration } from '@/features/integrations';
import { homeService } from '../services/home.service';
import type {
  ExtractionJob,
  HomeMetrics,
  HomeIntegrationsSummary,
} from '../types/home.types';

export function useHome() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { products, isLoading: productsLoading, refetch: refreshProducts } = useProducts(50);

  const [integrations, setIntegrations] = useState<StoreIntegration[]>([]);
  const [integrationsLoading, setIntegrationsLoading] = useState<boolean>(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Limpeza de timers ao desmontar o componente
  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  // Carrega status real das integrações com fallback silencioso
  const fetchIntegrations = useCallback(async () => {
    setIntegrationsLoading(true);
    try {
      const stores = await integrationService.listIntegrations();
      setIntegrations(stores);
    } catch {
      // Fallback gracioso caso a API ainda não possua lojas configuradas
      setIntegrations([]);
    } finally {
      setIntegrationsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIntegrations();
  }, [fetchIntegrations]);

  // Derivação dos jobs recentes a partir dos produtos do catálogo
  const jobs: ExtractionJob[] = useMemo(() => {
    return homeService.mapProductsToJobs(products, 10);
  }, [products]);

  // Cálculo das métricas consolidadas
  const metrics: HomeMetrics = useMemo(() => {
    return homeService.calculateMetrics(products);
  }, [products]);

  // Resumo de integrações ativas
  const integrationsSummary: HomeIntegrationsSummary = useMemo(() => {
    const hasShopify = integrations.some(
      (s) => s.platform === 'SHOPIFY' && s.status === 'CONNECTED'
    );
    const hasNuvemshop = integrations.some(
      (s) => s.platform === 'NUVEMSHOP' && s.status === 'CONNECTED'
    );
    // Mercado Pago e BYOK são habilitados por padrão no tenant ativo
    const hasMercadoPago = true;
    const hasByokKeys = true;

    let connectedCount = (hasMercadoPago ? 1 : 0) + (hasByokKeys ? 1 : 0);
    if (hasShopify) connectedCount += 1;
    if (hasNuvemshop) connectedCount += 1;

    return {
      connectedCount,
      totalIntegrations: 4,
      hasShopify,
      hasNuvemshop,
      hasMercadoPago,
      hasByokKeys,
    };
  }, [integrations]);

  const handleViewJob = useCallback(
    (_job: ExtractionJob) => {
      navigate('/catalog');
    },
    [navigate]
  );

  const handleExportJob = useCallback((job: ExtractionJob) => {
    try {
      homeService.exportJobAsCsv(job);
      setToastMessage(`Download concluído para "${job.productName}".`);
    } catch {
      setToastMessage(`Erro ao exportar "${job.productName}".`);
    }

    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
      toastTimeoutRef.current = null;
    }, 3500);
  }, []);

  const handleConfigureKeys = useCallback(() => {
    navigate('/settings');
  }, [navigate]);

  const handleOpenSupport = useCallback(() => {
    window.open('https://discord.gg', '_blank', 'noopener,noreferrer');
  }, []);

  const handleDismissToast = useCallback(() => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
      toastTimeoutRef.current = null;
    }
    setToastMessage(null);
  }, []);

  const userName = user?.name || (user?.email ? user.email.split('@')[0] : 'Usuário');
  const planName = user?.plan
    ? user.plan.startsWith('Plano')
      ? user.plan
      : `Plano ${user.plan}`
    : 'Plano Pro';

  return {
    // Estados
    userName,
    planName,
    isApiOnline: true,
    jobs,
    metrics,
    integrationsSummary,
    isLoading: productsLoading || integrationsLoading,
    toastMessage,

    // Handlers
    handleViewJob,
    handleExportJob,
    handleConfigureKeys,
    handleOpenSupport,
    handleDismissToast,
    refreshData: () => {
      refreshProducts();
      fetchIntegrations();
    },
  };
}

export default useHome;
