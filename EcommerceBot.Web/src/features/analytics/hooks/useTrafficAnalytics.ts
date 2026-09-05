/**
 * src/features/analytics/hooks/useTrafficAnalytics.ts
 *
 * Hook para gerenciamento de métricas de tráfego, instalação do tracker.js e verificação de tags.
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/features/auth';
import { trafficAnalyticsService } from '../services/trafficAnalytics.service';
import type { TenantTrafficOverview, VerifyTagResponse } from '../types/traffic.types';
import { getErrorMessage } from '@/utils/errors';

export const useTrafficAnalytics = (enabled: boolean = true) => {
  const { user } = useAuth();
  const tenantId = user?.tenants?.[0] || 'meu-tenant-id';

  const [days, setDays] = useState<number>(30);
  const [loadingTraffic, setLoadingTraffic] = useState<boolean>(true);
  const [overview, setOverview] = useState<TenantTrafficOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Estado de Cópia e Verificação de Tag
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [storeUrlInput, setStoreUrlInput] = useState<string>('');
  const [verifyingTag, setVerifyingTag] = useState<boolean>(false);
  const [tagStatus, setTagStatus] = useState<VerifyTagResponse | null>(null);
  const [tagError, setTagError] = useState<string | null>(null);

  const trackerSnippet = `<script async src="https://api.ecomautobot.com/tracker.js" data-tenant-id="${tenantId}"></script>`;

  const fetchTrafficData = useCallback(async (isManualAction = false) => {
    if (isManualAction) {
      setLoadingTraffic(true);
      setError(null);
    }
    try {
      const res = await trafficAnalyticsService.getTrafficOverview(days);
      setOverview(res);
    } catch (err: unknown) {
      const msg = getErrorMessage(err, 'Erro ao carregar métricas de tráfego do lojista.');
      setError(msg);
    } finally {
      setLoadingTraffic(false);
    }
  }, [days]);

  useEffect(() => {
    if (!enabled) return;
    let isCancelled = false;

    trafficAnalyticsService
      .getTrafficOverview(days)
      .then((res) => {
        if (!isCancelled) {
          setOverview(res);
        }
      })
      .catch((err: unknown) => {
        if (!isCancelled) {
          setError(getErrorMessage(err, 'Erro ao carregar métricas de tráfego do lojista.'));
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setLoadingTraffic(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [enabled, days]);

  const handleCopySnippet = async () => {
    try {
      await navigator.clipboard.writeText(trackerSnippet);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 3000);
    } catch (err) {
      console.error('Erro ao copiar snippet:', err);
    }
  };

  const handleVerifyTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeUrlInput.trim()) return;

    setVerifyingTag(true);
    setTagError(null);
    try {
      const res = await trafficAnalyticsService.verifyStoreTag(storeUrlInput.trim());
      setTagStatus(res);
    } catch (err: unknown) {
      const msg = getErrorMessage(err, 'Erro ao verificar instalação da tag na loja.');
      setTagError(msg);
    } finally {
      setVerifyingTag(false);
    }
  };

  return {
    tenantId,
    days,
    setDays,
    loadingTraffic,
    overview,
    error,
    trackerSnippet,
    isCopied,
    storeUrlInput,
    setStoreUrlInput,
    verifyingTag,
    tagStatus,
    tagError,
    fetchTrafficData,
    handleCopySnippet,
    handleVerifyTag,
  };
};

export default useTrafficAnalytics;
