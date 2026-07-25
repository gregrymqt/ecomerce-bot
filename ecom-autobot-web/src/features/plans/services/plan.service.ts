import { apiClient } from '@/lib/apiClient';
import type {
  Plan,
  CreatePlanPayload,
  UpdatePlanPayload,
  SearchPlansParams,
  PlanSearchResponse,
} from '../types/plan.type';

export const planService = {
  /**
   * [Público / Tenant] Lista catálogo de planos disponíveis para contratação.
   */
  getPublicPlans: async (limit: number = 20, offset: number = 0): Promise<Plan[]> => {
    const response = await apiClient.get<Plan[]>('/api/v1/plans/public', {
      params: { limit, offset },
    });
    return response.data;
  },

  /**
   * [Admin] Lista planos armazenados localmente na base PostgreSQL/Redis.
   */
  getLocalPlans: async (limit: number = 50, offset: number = 0): Promise<Plan[]> => {
    const response = await apiClient.get<Plan[]>('/api/v1/plans/local', {
      params: { limit, offset },
    });
    return response.data;
  },

  /**
   * [Admin] Busca avançada de planos diretamente no Mercado Pago.
   */
  searchPlans: async (params?: SearchPlansParams): Promise<PlanSearchResponse> => {
    const response = await apiClient.get<PlanSearchResponse>('/api/v1/plans/', {
      params: {
        status: params?.status || undefined,
        q: params?.q || undefined,
        sort: params?.sort || undefined,
        criteria: params?.criteria || undefined,
        offset: params?.offset || 0,
        limit: params?.limit || 20,
      },
    });
    return response.data;
  },

  /**
   * [Admin] Obtém os detalhes de um plano específico por ID.
   */
  getPlanById: async (planId: string): Promise<Plan> => {
    const response = await apiClient.get<Plan>(`/api/v1/plans/${planId}`);
    return response.data;
  },

  /**
   * [Admin] Cria um novo plano no Mercado Pago e sincroniza na base local.
   */
  createPlan: async (payload: CreatePlanPayload): Promise<Plan> => {
    const response = await apiClient.post<Plan>('/api/v1/plans/', payload);
    return response.data;
  },

  /**
   * [Admin] Atualiza ou cancela um plano existente.
   */
  updatePlan: async (planId: string, payload: UpdatePlanPayload): Promise<Plan> => {
    const response = await apiClient.put<Plan>(`/api/v1/plans/${planId}`, payload);
    return response.data;
  },
};