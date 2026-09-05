/**
 * src/features/wallet/hooks/useWallet.ts
 *
 * Custom Hook reativo para gerenciamento do estado da Carteira (Wallet).
 * Controla consulta de saldo, extrato de transações de créditos, filtros e estados de carregamento.
 */

import { useState, useEffect, useCallback } from 'react';
import { walletService } from '../services/wallet.service';
import type {
  CreditTransaction,
  StatementFilters,
  TransactionType,
  UseWalletReturn,
} from '../types';
import { getErrorMessage } from '@/utils/errors';

export function useWallet(initialPage = 1, limit = 10): UseWalletReturn {
  const [balance, setBalance] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [loadingBalance, setLoadingBalance] = useState<boolean>(true);
  const [loadingStatement, setLoadingStatement] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState<number>(initialPage);
  const [typeFilter, setTypeFilter] = useState<TransactionType | 'ALL'>('ALL');

  const handlePageChange: React.Dispatch<React.SetStateAction<number>> = useCallback((action) => {
    setLoadingStatement(true);
    setPage(action);
  }, []);

  const handleTypeFilterChange: React.Dispatch<React.SetStateAction<TransactionType | 'ALL'>> = useCallback(
    (action) => {
      setLoadingStatement(true);
      setTypeFilter(action);
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
      if (isManualAction) {
        setLoadingStatement(true);
        setError(null);
      }
      try {
        const filters: StatementFilters = {
          page,
          limit,
          type: typeFilter === 'ALL' ? undefined : typeFilter,
          ...overrideFilters,
        };
        const data = await walletService.getWalletStatement(filters);
        setTransactions(data.transactions || []);
        setTotalCount(data.total_count || 0);

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
   * Recarrega tanto o saldo quanto o extrato de movimentações.
   */
  const refetchWallet = useCallback(async (): Promise<[void, void]> => {
    return Promise.all([fetchBalance(true), fetchStatement(undefined, true)]);
  }, [fetchBalance, fetchStatement]);

  // Efeito inicial para buscar o saldo
  useEffect(() => {
    let isCancelled = false;

    walletService
      .getWalletBalance()
      .then((data) => {
        if (!isCancelled) {
          setBalance(data.balance_credits);
        }
      })
      .catch((err: unknown) => {
        if (!isCancelled) {
          setError(getErrorMessage(err, 'Falha ao consultar o saldo da carteira.'));
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setLoadingBalance(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, []);

  // Efeito reativo para buscar o extrato quando a página ou o filtro mudar
  useEffect(() => {
    let isCancelled = false;

    const filters: StatementFilters = {
      page,
      limit,
      type: typeFilter === 'ALL' ? undefined : typeFilter,
    };

    walletService
      .getWalletStatement(filters)
      .then((data) => {
        if (!isCancelled) {
          setTransactions(data.transactions || []);
          setTotalCount(data.total_count || 0);

          if (typeof data.balance_credits === 'number') {
            setBalance(data.balance_credits);
          }
        }
      })
      .catch((err: unknown) => {
        if (!isCancelled) {
          setError(getErrorMessage(err, 'Falha ao buscar o extrato da carteira.'));
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setLoadingStatement(false);
        }
      });

    return () => {
      isCancelled = true;
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
