/**
 * src/features/wallet/hooks/useRealtimeWalletBalance.ts
 *
 * Custom Hook reativo para sincronização do saldo de créditos em tempo real.
 * Realiza carga inicial via REST e escuta atualizações via SSE (/api/v1/demo/stream)
 * e eventos internos de janela (CustomEvent).
 */

import { useState, useEffect, useCallback } from 'react';
import { walletService } from '../services/wallet.service';
import { SSEClient } from '@/lib/sseClient';
import { getErrorMessage } from '@/utils/errors';

export interface RealtimeWalletBalanceReturn {
  balance: number | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useRealtimeWalletBalance(): RealtimeWalletBalanceReturn {
  const [balance, setBalance] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBalance = useCallback(async (manual = false) => {
    if (manual) {
      setIsLoading(true);
      setError(null);
    }
    try {
      const data = await walletService.getWalletBalance();
      setBalance(data.balance_credits);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Erro ao carregar saldo de créditos.'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Carga inicial
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
          setError(getErrorMessage(err, 'Erro ao carregar saldo de créditos.'));
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, []);

  // Listener para eventos internos de atualização de carteira
  useEffect(() => {
    const handleCustomUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<{ balance?: number }>;
      if (typeof customEvent.detail?.balance === 'number') {
        setBalance(customEvent.detail.balance);
      } else {
        fetchBalance(false);
      }
    };

    window.addEventListener('wallet:balance-updated', handleCustomUpdate);
    return () => {
      window.removeEventListener('wallet:balance-updated', handleCustomUpdate);
    };
  }, [fetchBalance]);

  // Sincronização em tempo real via SSE
  useEffect(() => {
    const sse = new SSEClient<Record<string, unknown>>();

    sse.connect({
      endpoint: '/api/v1/demo/stream',
      onMessage: (data) => {
        if (!data || typeof data !== 'object') return;

        // Se o evento SSE trouxer saldo atualizado
        if (typeof data.balance_credits === 'number') {
          setBalance(data.balance_credits);
        } else if (typeof data.balanceCredits === 'number') {
          setBalance(data.balanceCredits);
        } else if (
          data.type === 'payment_approved' ||
          data.type === 'payment_refunded' ||
          data.type === 'balance_updated'
        ) {
          fetchBalance(false);
        }
      },
      onError: () => {
        // Conexão SSE com reconnect gerenciado pelo navegador
      },
    });

    return () => {
      sse.close();
    };
  }, [fetchBalance]);

  return {
    balance,
    isLoading,
    error,
    refresh: () => fetchBalance(true),
  };
}

export default useRealtimeWalletBalance;
