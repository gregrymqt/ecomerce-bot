/**
 * src/features/wallet/hooks/useWallet.ts
 *
 * Custom Hook reativo para gerenciamento do estado da Carteira (Wallet).
 * Controla consulta de saldo, extrato de transações de créditos, filtros e estados de carregamento.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { walletService } from '../services/wallet.service';
import type {
  CreditTransaction,
  StatementFilters,
  TransactionType,
  UseWalletReturn,
} from '../types';
import { getErrorMessage } from '@/utils/errors';

interface StatementCacheItem {
  transactions: CreditTransaction[];
  totalCount: number;
  balanceCredits?: number;
}

export function useWallet(initialPage = 1, limit = 10): UseWalletReturn {
  const [balance, setBalance] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [loadingBalance, setLoadingBalance] = useState<boolean>(true);
  const [loadingStatement, setLoadingStatement] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState<number>(initialPage);
  const [typeFilter, setTypeFilter] = useState<TransactionType | 'ALL'>('ALL');

  // Cache em memória para abas e páginas já visitadas
  const statementCacheRef = useRef<Map<string, StatementCacheItem>>(new Map());

  const handlePageChange: React.Dispatch<React.SetStateAction<number>> = useCallback((action) => {
    setLoadingStatement(true);
    setPage(action);
  }, []);

  const handleTypeFilterChange: React.Dispatch<React.SetStateAction<TransactionType | 'ALL'>> = useCallback(
    (action) => {
      setTypeFilter((prev) => {
        const next = typeof action === 'function' ? action(prev) : action;
        if (next !== prev) {
          setPage(1);
        }
        return next;
      });
    },
    []
  );

  /**
   * Carrega o saldo atual de créditos via walletService.
   */
  const fetchBalance = useCallback(async (isManualAction = false) => {
    if (isManualAction) {
      setLoadingBalance(true);
      setError(null);
    }
    try {
      const data = await walletService.getWalletBalance();
      setBalance(data.balance_credits);
    } catch (err: unknown) {
      const msg = getErrorMessage(err, 'Falha ao consultar o saldo da carteira.');
      setError(msg);
    } finally {
      setLoadingBalance(false);
    }
  }, []);

  /**
   * Carrega o extrato de movimentações de crédito via walletService.
   */
  const fetchStatement = useCallback(
    async (overrideFilters?: StatementFilters, isManualAction = false) => {
      const activeType = overrideFilters?.type !== undefined ? overrideFilters.type : (typeFilter === 'ALL' ? undefined : typeFilter);
      const activePage = overrideFilters?.page ?? page;
      const activeLimit = overrideFilters?.limit ?? limit;
      const cacheKey = `${activeType ?? 'ALL'}_${activePage}_${activeLimit}`;

      if (isManualAction) {
        statementCacheRef.current.delete(cacheKey);
        setLoadingStatement(true);
        setError(null);
      } else {
        const cached = statementCacheRef.current.get(cacheKey);
        if (cached) {
          setTransactions(cached.transactions);
          setTotalCount(cached.totalCount);
          if (typeof cached.balanceCredits === 'number') {
            setBalance(cached.balanceCredits);
          }
          setLoadingStatement(false);
          return;
        }
      }

      try {
        const filters: StatementFilters = {
          page: activePage,
          limit: activeLimit,
          type: activeType,
        };
        const data = await walletService.getWalletStatement(filters);
        const fetchedTx = data.transactions || [];
        const fetchedTotal = data.total_count || 0;

        statementCacheRef.current.set(cacheKey, {
          transactions: fetchedTx,
          totalCount: fetchedTotal,
          balanceCredits: typeof data.balance_credits === 'number' ? data.balance_credits : undefined,
        });

        setTransactions(fetchedTx);
        setTotalCount(fetchedTotal);

        if (typeof data.balance_credits === 'number') {
          setBalance(data.balance_credits);
        }
      } catch (err: unknown) {
        const msg = getErrorMessage(err, 'Falha ao buscar o extrato da carteira.');
        setError(msg);
      } finally {
        setLoadingStatement(false);
      }
    },
    [page, limit, typeFilter]
  );

  /**
   * Recarrega tanto o saldo quanto o extrato de movimentações invalidando o cache.
   */
  const refetchWallet = useCallback(async (): Promise<[void, void]> => {
    statementCacheRef.current.clear();
    return Promise.all([fetchBalance(true), fetchStatement(undefined, true)]);
  }, [fetchBalance, fetchStatement]);

  // Efeito inicial para buscar o saldo
  useEffect(() => {
    const controller = new AbortController();

    walletService
      .getWalletBalance(controller.signal)
      .then((data) => {
        setBalance(data.balance_credits);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        if ((err as { name?: string })?.name === 'CanceledError') return;
        setError(getErrorMessage(err, 'Falha ao consultar o saldo da carteira.'));
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoadingBalance(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, []);

  // Efeito reativo para buscar o extrato quando a página ou o filtro mudar (com suporte a cache)
  useEffect(() => {
    const cacheKey = `${typeFilter}_${page}_${limit}`;
    const cached = statementCacheRef.current.get(cacheKey);

    if (cached) {
      setTransactions(cached.transactions);
      setTotalCount(cached.totalCount);
      if (typeof cached.balanceCredits === 'number') {
        setBalance(cached.balanceCredits);
      }
      setLoadingStatement(false);
      return;
    }

    setLoadingStatement(true);
    const controller = new AbortController();

    const filters: StatementFilters = {
      page,
      limit,
      type: typeFilter === 'ALL' ? undefined : typeFilter,
    };

    walletService
      .getWalletStatement(filters, controller.signal)
      .then((data) => {
        const fetchedTx = data.transactions || [];
        const fetchedTotal = data.total_count || 0;

        statementCacheRef.current.set(cacheKey, {
          transactions: fetchedTx,
          totalCount: fetchedTotal,
          balanceCredits: typeof data.balance_credits === 'number' ? data.balance_credits : undefined,
        });

        setTransactions(fetchedTx);
        setTotalCount(fetchedTotal);

        if (typeof data.balance_credits === 'number') {
          setBalance(data.balance_credits);
        }
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        if ((err as { name?: string })?.name === 'CanceledError') return;
        setError(getErrorMessage(err, 'Falha ao buscar o extrato da carteira.'));
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoadingStatement(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [page, limit, typeFilter]);

  return {
    balance,
    transactions,
    totalCount,
    loadingBalance,
    loadingStatement,
    error,
    page,
    typeFilter,
    setPage: handlePageChange,
    setTypeFilter: handleTypeFilterChange,
    refetchWallet,
  };
}

export default useWallet;
