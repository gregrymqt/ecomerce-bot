/**
 * src/features/analytics/hooks/useMlAnalytics.ts
 *
 * Hook para consulta e execução assíncrona de modelos de Machine Learning (RFM, Churn, LTV).
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { mlAnalyticsService } from '../services/mlAnalytics.service';
import type { MlInsightsResponse } from '../types/ml.types';
import { getErrorMessage } from '@/utils/errors';

export const useMlAnalytics = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [triggering, setTriggering] = useState<boolean>(false);
  const [insights, setInsights] = useState<MlInsightsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [triggerMessage, setTriggerMessage] = useState<string | null>(null);
  const [copiedActionId, setCopiedActionId] = useState<string | null>(null);

  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchInsights = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await mlAnalyticsService.getLatestInsights();
      setInsights(res);
    } catch (err: unknown) {
      const msg = getErrorMessage(err, 'Erro ao buscar insights de Machine Learning.');
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInsights();
    return () => {
      if (pollTimerRef.current) {
        clearTimeout(pollTimerRef.current);
      }
    };
  }, [fetchInsights]);

  const handleTriggerAnalysis = async () => {
    setTriggering(true);
    setError(null);
    setTriggerMessage(null);
    try {
      const resp = await mlAnalyticsService.triggerAnalysis('FULL_ANALYTICS');
      setTriggerMessage(resp.message || 'Análise de Machine Learning enfileirada com sucesso.');

      // Polling curto após 3.5s para carregar os novos dados processados pelo Python Worker
      pollTimerRef.current = setTimeout(async () => {
        await fetchInsights();
        setTriggering(false);
      }, 3500);
    } catch (err: unknown) {
      const msg = getErrorMessage(err, 'Erro ao disparar análise preditiva de IA.');
      setError(msg);
      setTriggering(false);
    }
  };

  const handleCopyCoupon = (customerId: string, code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedActionId(customerId);
    setTimeout(() => setCopiedActionId(null), 2500);
  };

  return {
    loading,
    triggering,
    insights,
    error,
    triggerMessage,
    copiedActionId,
    fetchInsights,
    handleTriggerAnalysis,
    handleCopyCoupon,
  };
};

export default useMlAnalytics;
