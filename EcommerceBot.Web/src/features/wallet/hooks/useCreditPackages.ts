/**
 * src/features/wallet/hooks/useCreditPackages.ts
 *
 * Custom Hook reativo para gestão de estado dos Pacotes de Recarga de Créditos.
 * Encapsula chamadas ao walletService e fornece os pacotes disponíveis para os componentes de UI.
 * Respeita rigorosamente a arquitetura em 4 camadas e a skill Impeccable.
 */

import { useState, useEffect, useCallback } from 'react';
import { walletService, CANONICAL_RECHARGE_PACKAGES } from '../services/wallet.service';
import type { RechargePackage } from '../types';
import { getErrorMessage } from '@/utils/errors';

export interface UseCreditPackagesReturn {
  packages: RechargePackage[];
  loading: boolean;
  error: string | null;
  refetchPackages: () => Promise<void>;
}

export function useCreditPackages(): UseCreditPackagesReturn {
  const [packages, setPackages] = useState<RechargePackage[]>(CANONICAL_RECHARGE_PACKAGES);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPackages = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await walletService.getCreditPackages();
      setPackages(data);
    } catch (err: unknown) {
      const msg = getErrorMessage(err, 'Falha ao carregar pacotes de recarga.');
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isCancelled = false;

    walletService
      .getCreditPackages()
      .then((data) => {
        if (!isCancelled) {
          setPackages(data);
        }
      })
      .catch((err: unknown) => {
        if (!isCancelled) {
          setError(getErrorMessage(err, 'Falha ao carregar pacotes de recarga.'));
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

  return {
    packages,
    loading,
    error,
    refetchPackages: fetchPackages,
  };
}

export default useCreditPackages;
