/**
 * src/features/metering/hooks/useMetering.ts
 *
 * Custom Hook reativo para gerenciamento do estado de telemetria, saldo de créditos e extrato de LLM.
 */

import { useState, useEffect, useCallback } from 'react';
import { meteringService } from '../services/metering.service';
import { getErrorMessage } from '@/utils/errors';
import type {
  TenantCreditBalanceResponse,
  PaginatedLLMUsageResponse,
  LLMUsageFilterParams,
} from '../types';

export interface UseMeteringReturn {
  balance: TenantCreditBalanceResponse | null;
  usageLogs: PaginatedLLMUsageResponse | null;
  isLoadingBalance: boolean;
  isLoadingUsage: boolean;
  error: string | null;
  page: number;
  limit: number;
  filters: Omit<LLMUsageFilterParams, 'page' | 'limit'>;
  fetchBalance: () => Promise<void>;
  fetchUsageLogs: (params?: LLMUsageFilterParams) => Promise<void>;
  refetchAll: () => Promise<void>;
  changePage: (newPage: number) => void;
  applyFilters: (newFilters: Omit<LLMUsageFilterParams, 'page' | 'limit'>) => void;
}

export const useMetering = (
  initialPage = 1,
  initialLimit = 20
): UseMeteringReturn => {
  const [balance, setBalance] = useState<TenantCreditBalanceResponse | null>(null);
  const [usageLogs, setUsageLogs] = useState<PaginatedLLMUsageResponse | null>(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState<boolean>(true);
  const [isLoadingUsage, setIsLoadingUsage] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState<number>(initialPage);
  const [limit] = useState<number>(initialLimit);
  const [filters, setFilters] = useState<Omit<LLMUsageFilterParams, 'page' | 'limit'>>({});

  const fetchBalance = useCallback(async (isManualAction = false) => {
    if (isManualAction) {
      setIsLoadingBalance(true);
      setError(null);
    }
    try {
      const data = await meteringService.getCreditBalance();
      setBalance(data);
    } catch (err: unknown) {
      const msg = getErrorMessage(err, 'Falha ao consultar saldo de créditos.');
      setError(msg);
    } finally {
      setIsLoadingBalance(false);
    }
  }, []);

  const fetchUsageLogs = useCallback(
    async (params?: LLMUsageFilterParams, isManualAction = false) => {
      if (isManualAction) {
        setIsLoadingUsage(true);
        setError(null);
      }
      try {
        const mergedParams: LLMUsageFilterParams = {
          page,
          limit,
          ...filters,
          ...params,
        };
        const data = await meteringService.getUsageLogs(mergedParams);
        setUsageLogs(data);
      } catch (err: unknown) {
        const msg = getErrorMessage(err, 'Falha ao buscar extrato de consumo de LLM.');
        setError(msg);
      } finally {
        setIsLoadingUsage(false);
      }
    },
    [page, limit, filters]
  );

  const refetchAll = useCallback(async () => {
    await Promise.all([fetchBalance(true), fetchUsageLogs(undefined, true)]);
  }, [fetchBalance, fetchUsageLogs]);

  const changePage = useCallback((newPage: number) => {
    setIsLoadingUsage(true);
    setPage(newPage);
  }, []);

  const applyFilters = useCallback((newFilters: Omit<LLMUsageFilterParams, 'page' | 'limit'>) => {
    setIsLoadingUsage(true);
    setFilters(newFilters);
    setPage(1);
  }, []);

  useEffect(() => {
    let isCancelled = false;

    meteringService
      .getCreditBalance()
      .then((data) => {
        if (!isCancelled) {
          setBalance(data);
        }
      })
      .catch((err: unknown) => {
        if (!isCancelled) {
          setError(getErrorMessage(err, 'Falha ao consultar saldo de créditos.'));
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setIsLoadingBalance(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    let isCancelled = false;

    const mergedParams: LLMUsageFilterParams = {
      page,
      limit,
      ...filters,
    };

    meteringService
      .getUsageLogs(mergedParams)
      .then((data) => {
        if (!isCancelled) {
          setUsageLogs(data);
        }
      })
      .catch((err: unknown) => {
        if (!isCancelled) {
          setError(getErrorMessage(err, 'Falha ao buscar extrato de consumo de LLM.'));
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setIsLoadingUsage(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [page, limit, filters]);

  return {
    balance,
    usageLogs,
    isLoadingBalance,
    isLoadingUsage,
    error,
    page,
    limit,
    filters,
    fetchBalance,
    fetchUsageLogs,
    refetchAll,
    changePage,
    applyFilters,
  };
};

export default useMetering;
