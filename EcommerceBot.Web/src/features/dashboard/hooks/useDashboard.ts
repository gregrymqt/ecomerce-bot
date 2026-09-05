/**
 * src/features/dashboard/hooks/useDashboard.ts
 *
 * Custom Hook reativo para gestão de dados e telemetria do Dashboard Principal.
 * Controla o filtro por período temporal (DAY, WEEK, MONTH), polling leve a cada 30 segundos
 * quando a aba estiver visível, e atualização independente de atividades dos robôs.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { dashboardService } from '../services/dashboard.service';
import type {
  DashboardTelemetryResponse,
  PeriodFilter,
  RobotActivity,
} from '../types';
import { getErrorMessage } from '@/utils/errors';

export function useDashboard(initialPeriod: PeriodFilter = 'WEEK') {
  // 1. Estados Reativos Principais
  const [data, setData] = useState<DashboardTelemetryResponse | null>(null);
  const [period, setPeriod] = useState<PeriodFilter>(initialPeriod);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const isFirstMount = useRef<boolean>(true);

  // 2. Carregamento completo da telemetria
  const fetchDashboard = useCallback(
    async (selectedPeriod: PeriodFilter = period, isSilent = false) => {
      if (!isSilent && !isFirstMount.current) {
        setRefreshing(true);
        setError(null);
      }

      try {
        const response = await dashboardService.getTelemetry(selectedPeriod);
        setData(response);
      } catch (err: unknown) {
        const message = getErrorMessage(err, 'Erro ao carregar telemetria do Dashboard.');
        setError(message);
      } finally {
        setLoading(false);
        setRefreshing(false);
        isFirstMount.current = false;
      }
    },
    [period]
  );

  // Requisita dados ao mudar o período
  useEffect(() => {
    let isCancelled = false;

    dashboardService
      .getTelemetry(period)
      .then((response) => {
        if (!isCancelled) {
          setData(response);
        }
      })
      .catch((err: unknown) => {
        if (!isCancelled) {
          setError(getErrorMessage(err, 'Erro ao carregar telemetria do Dashboard.'));
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setLoading(false);
          setRefreshing(false);
          isFirstMount.current = false;
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [period]);

  // 3. Handler de Alteração de Período
  const handlePeriodChange = useCallback((newPeriod: PeriodFilter) => {
    setRefreshing(true);
    setPeriod(newPeriod);
  }, []);

  // 4. Recarregar apenas a lista de atividades dos robôs (sem afundar o restante do estado)
  const refreshActivities = useCallback(async () => {
    try {
      const activities: RobotActivity[] = await dashboardService.getRecentActivities(10);
      setData((prev) => (prev ? { ...prev, recent_activities: activities } : null));
    } catch {
      // Ignora falhas esporádicas de polling de atividades
    }
  }, []);

  // 5. Polling automático a cada 30 segundos (somente se a aba estiver ativa/visível)
  useEffect(() => {
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        fetchDashboard(period, true); // atualização silenciosa sem piscar loader principal
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [period, fetchDashboard]);

  // Formatador auxiliar de horário da última atualização
  const formatLastUpdated = useCallback((): string => {
    return new Date().toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }, []);

  return {
    // Estados
    data,
    period,
    loading,
    refreshing,
    error,
    setError,

    // Handlers e Métodos
    fetchDashboard: (p?: PeriodFilter) => fetchDashboard(p || period),
    handlePeriodChange,
    refreshActivities,
    formatLastUpdated,
  };
}

export default useDashboard;
