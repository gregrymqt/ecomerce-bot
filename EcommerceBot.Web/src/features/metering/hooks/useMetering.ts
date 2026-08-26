import { useState, useEffect, useCallback } from 'react';
import { meteringService } from '@/features/metering';
import { getErrorMessage } from '@/utils/errors';
import type {
  TenantCreditBalanceResponse,
  PaginatedLLMUsageResponse,
  LLMUsageFilterParams,
} from '@/features/metering';

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
  const [isLoadingBalance, setIsLoadingBalance] = useState<boolean>(false);
  const [isLoadingUsage, setIsLoadingUsage] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState<number>(initialPage);
  const [limit] = useState<number>(initialLimit);
  const [filters, setFilters] = useState<Omit<LLMUsageFilterParams, 'page' | 'limit'>>({});

  const fetchBalance = useCallback(async () => {
    setIsLoadingBalance(true);
    setError(null);
    try {
      const data = await meteringService.getCreditBalance();
      setBalance(data);
    } catch (err) {
      const msg = getErrorMessage(err, 'Falha ao consultar saldo de créditos.');
      setError(msg);
    } finally {
      setIsLoadingBalance(false);
    }
  }, []);

  const fetchUsageLogs = useCallback(
    async (params?: LLMUsageFilterParams) => {
      setIsLoadingUsage(true);
      setError(null);
      try {
        const mergedParams: LLMUsageFilterParams = {
          page,
          limit,
          ...filters,
          ...params,
        };
        const data = await meteringService.getUsageLogs(mergedParams);
        setUsageLogs(data);
      } catch (err) {
        const msg = getErrorMessage(err, 'Falha ao buscar extrato de consumo de LLM.');
        setError(msg);
      } finally {
        setIsLoadingUsage(false);
      }
    },
    [page, limit, filters]
  );

  const refetchAll = useCallback(async () => {
    await Promise.all([fetchBalance(), fetchUsageLogs()]);
  }, [fetchBalance, fetchUsageLogs]);

  const changePage = useCallback((newPage: number) => {
    setPage(newPage);
  }, []);

  const applyFilters = useCallback((newFilters: Omit<LLMUsageFilterParams, 'page' | 'limit'>) => {
    setFilters(newFilters);
    setPage(1);
  }, []);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  useEffect(() => {
    fetchUsageLogs();
  }, [fetchUsageLogs]);

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
