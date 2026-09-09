/**
 * src/features/wallet/services/billing.service.ts
 *
 * Serviço assíncrono puro para consumo dos endpoints de faturamento
 * e consulta de CEP pública (ViaCEP).
 */

import { apiClient } from '@/lib/apiClient';
import type {
  TenantBillingProfile,
  UpsertTenantBillingProfilePayload,
  ViaCepAddressResponse,
} from '../types/billing.type';

export const billingService = {
  /**
   * Obtém o perfil de faturamento salvo para o Tenant atual.
   * Retorna null caso não tenha sido cadastrado ainda (404).
   */
  getBillingProfile: async (signal?: AbortSignal): Promise<TenantBillingProfile | null> => {
    try {
      const response = await apiClient.get<TenantBillingProfile>('/api/v1/billing/profile', {
        signal,
      });
      return response.data;
    } catch (err: unknown) {
      if (typeof err === 'object' && err !== null && 'response' in err) {
        const axiosErr = err as { response?: { status?: number } };
        if (axiosErr.response?.status === 404) {
          return null;
        }
      }
      throw err;
    }
  },

  /**
   * Cadastra ou atualiza o perfil de faturamento do Tenant.
   */
  upsertBillingProfile: async (
    payload: UpsertTenantBillingProfilePayload,
    signal?: AbortSignal
  ): Promise<TenantBillingProfile> => {
    const response = await apiClient.put<TenantBillingProfile>(
      '/api/v1/billing/profile',
      payload,
      { signal }
    );
    return response.data;
  },

  /**
   * Consulta dados de endereço via API pública do ViaCEP a partir do CEP.
   */
  fetchAddressByCep: async (
    cep: string,
    signal?: AbortSignal
  ): Promise<ViaCepAddressResponse | null> => {
    const cleanCep = cep.replace(/\D/g, '');
    if (cleanCep.length !== 8) return null;

    try {
      const resp = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`, {
        method: 'GET',
        signal,
      });

      if (!resp.ok) return null;
      const data = (await resp.json()) as ViaCepAddressResponse;

      if (data.erro) {
        return null;
      }

      return data;
    } catch {
      return null;
    }
  },
};

export default billingService;
