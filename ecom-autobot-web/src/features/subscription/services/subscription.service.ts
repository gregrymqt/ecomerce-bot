import { apiClient } from '@/lib/apiClient';
import type { PlanResponse } from '@/features/plans/types/plans.type';
import type {
  Subscription,
  TenantBillingStatus,
  CreateSubscriptionPayload,
  UpdateSubscriptionPayload,
  SearchSubscriptionsParams,
  PaginatedSubscriptionsResponse,
} from '../types/subscription.type';

export const subscriptionService = {
  /**
   * Obtém o status consolidado do plano e validade da assinatura do Tenant.
   */
  getBillingStatus: async (): Promise<TenantBillingStatus> => {
    const response = await apiClient.get<TenantBillingStatus>('/api/v1/subscriptions/status');
    return response.data;
  },

  /**
   * Busca e lista assinaturas do tenant com paginação e filtros.
   */
  searchSubscriptions: async (params?: SearchSubscriptionsParams): Promise<PaginatedSubscriptionsResponse> => {
    const response = await apiClient.get<PaginatedSubscriptionsResponse>('/api/v1/subscriptions', {
      params: {
        page: params?.page || 1,
        limit: params?.limit || 10,
        status: params?.status || undefined,
        payer_email: params?.payer_email || undefined,
        preapproval_plan_id: params?.preapproval_plan_id || undefined,
      },
    });
    return response.data;
  },

  /**
   * Busca uma assinatura específica por ID com opção de sincronizar no ato com o Mercado Pago.
   */
  getSubscriptionById: async (id: string, syncWithMp: boolean = false): Promise<Subscription> => {
    const response = await apiClient.get<Subscription>(`/api/v1/subscriptions/${id}`, {
      params: { sync_with_mp: syncWithMp },
    });
    return response.data;
  },

  /**
   * Cria uma nova assinatura recorrente.
   */
  createSubscription: async (payload: CreateSubscriptionPayload): Promise<Subscription> => {
    const response = await apiClient.post<Subscription>('/api/v1/subscriptions', payload);
    return response.data;
  },

  /**
   * Atualiza dados ou forma de pagamento de uma assinatura.
   */
  updateSubscription: async (id: string, payload: UpdateSubscriptionPayload): Promise<Subscription> => {
    const response = await apiClient.put<Subscription>(`/api/v1/subscriptions/${id}`, payload);
    return response.data;
  },

  /**
   * Cancela uma assinatura ativa no Mercado Pago e no banco de dados local.
   */
  cancelSubscription: async (id: string): Promise<Subscription> => {
    const response = await apiClient.delete<Subscription>(`/api/v1/subscriptions/${id}`);
    return response.data;
  },

  /**
   * Faz o download do relatório das assinaturas do tenant em CSV.
   */
  downloadCsvExport: async (): Promise<Blob> => {
    const response = await apiClient.get('/api/v1/subscriptions/export', {
      responseType: 'blob',
    });
    return response.data;
  },

  /**
   * Obtém a lista de planos públicos ativos do backend (/api/v1/plans/public).
   */
  getPublicPlans: async (): Promise<PlanResponse[]> => {
    const response = await apiClient.get<PlanResponse[]>('/api/v1/plans/public');
    return response.data;
  },
};