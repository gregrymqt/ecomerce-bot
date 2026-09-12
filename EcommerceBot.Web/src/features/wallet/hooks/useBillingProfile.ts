/**
 * src/features/wallet/hooks/useBillingProfile.ts
 *
 * Hook reativo para gestão de dados fiscais e endereço de faturamento do Tenant.
 * Suporta consulta inicial, salvamento e autopreenchimento por CEP (ViaCEP).
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { billingService } from '../services/billing.service';
import type {
  TenantBillingProfile,
  UpsertTenantBillingProfilePayload,
  ViaCepAddressResponse,
} from '../types/billing.type';
import { getErrorMessage } from '@/utils/errors';

export function useBillingProfile(enabled: boolean = true) {
  const [profile, setProfile] = useState<TenantBillingProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(enabled);
  const [saving, setSaving] = useState<boolean>(false);
  const [cepLoading, setCepLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchProfile = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      const data = await billingService.getBillingProfile(controller.signal);
      setProfile(data);
    } catch (err: unknown) {
      if ((err as Error)?.name !== 'CanceledError' && (err as Error)?.name !== 'AbortError') {
        setError(getErrorMessage(err, 'Erro ao carregar dados de faturamento.'));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    let isMounted = true;
    const controller = new AbortController();
    abortControllerRef.current = controller;

    billingService
      .getBillingProfile(controller.signal)
      .then((data) => {
        if (isMounted) {
          setProfile(data);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (isMounted && (err as Error)?.name !== 'CanceledError' && (err as Error)?.name !== 'AbortError') {
          setError(getErrorMessage(err, 'Erro ao carregar dados de faturamento.'));
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [enabled]);

  const saveProfile = useCallback(
    async (payload: UpsertTenantBillingProfilePayload): Promise<TenantBillingProfile> => {
      setSaving(true);
      setError(null);
      try {
        const saved = await billingService.upsertBillingProfile(payload);
        setProfile(saved);
        return saved;
      } catch (err: unknown) {
        const msg = getErrorMessage(err, 'Erro ao salvar dados de faturamento.');
        setError(msg);
        throw new Error(msg, { cause: err });
      } finally {
        setSaving(false);
      }
    },
    []
  );

  const lookupCep = useCallback(
    async (cep: string): Promise<ViaCepAddressResponse | null> => {
      const clean = cep.replace(/\D/g, '');
      if (clean.length !== 8) return null;

      setCepLoading(true);
      try {
        const address = await billingService.fetchAddressByCep(clean);
        return address;
      } catch {
        return null;
      } finally {
        setCepLoading(false);
      }
    },
    []
  );

  return {
    profile,
    hasProfile: Boolean(profile && profile.document_number),
    loading,
    saving,
    cepLoading,
    error,
    clearError: () => setError(null),
    fetchProfile,
    saveProfile,
    lookupCep,
  };
}

export default useBillingProfile;
