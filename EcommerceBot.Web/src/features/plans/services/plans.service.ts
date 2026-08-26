/**
 * src/features/plans/services/plans.service.ts
 * Camada de serviços HTTP para consumo dos endpoints administrativos de Planos (/api/v1/plans/*).
 */

import { apiClient } from '@/lib/apiClient';
import type {
  CreatePlanRequest,
  PlanResponse,
  PlanSearchResponse,
  SearchPlansQueryParams,
  UpdatePlanRequest,
} from '@/features/plans';

export const plansService = {
  /**
   * Cria um novo plano de assinatura no Mercado Pago e no PostgreSQL/Redis local.
   * Exige permissão de Admin (POST /api/v1/plans/).
   */
  createPlan: async (payload: CreatePlanRequest): Promise<PlanResponse> => {
    const response = await apiClient.post<PlanResponse>('/api/v1/plans/', payload);
    return response.data;
  },

  /**
   * Busca e filtra planos diretamente da API do Mercado Pago.
   * Exige permissão de Admin (GET /api/v1/plans/).
   */
  searchMpPlans: async (params?: SearchPlansQueryParams): Promise<PlanSearchResponse> => {
    const response = await apiClient.get<PlanSearchResponse>('/api/v1/plans/', {
      params: {
        status: params?.status || undefined,
        q: params?.q || undefined,
        sort: params?.sort || undefined,
        criteria: params?.criteria || undefined,
        offset: params?.offset ?? 0,
        limit: params?.limit ?? 20,
      },
    });
    return response.data;
  },

  /**
   * Lista os planos sincronizados localmente no PostgreSQL e Redis.
   * Exige permissão de Admin (GET /api/v1/plans/local).
   */
  listLocalPlans: async (limit = 50, offset = 0): Promise<PlanResponse[]> => {
    const response = await apiClient.get<PlanResponse[]>('/api/v1/plans/local', {
      params: { limit, offset },
    });
    return response.data;
  },

  /**
   * Obtém detalhes de um plano pelo seu ID de referência externa (Mercado Pago).
   * Exige permissão de Admin (GET /api/v1/plans/external/{external_id}).
   */
  getPlanByExternalId: async (externalId: string): Promise<PlanResponse> => {
    const response = await apiClient.get<PlanResponse>(`/api/v1/plans/external/${externalId}`);
    return response.data;
  },

  /**
   * Obtém detalhes de um plano pelo ID primário local/Mercado Pago.
   * Exige permissão de Admin (GET /api/v1/plans/{plan_id}).
   */
  getPlanById: async (planId: string): Promise<PlanResponse> => {
    const response = await apiClient.get<PlanResponse>(`/api/v1/plans/${planId}`);
    return response.data;
  },

  /**
   * Atualiza ou altera o status (ativo/cancelado) de um plano de assinatura.
   * Exige permissão de Admin (PUT /api/v1/plans/{plan_id}).
   */
  updatePlan: async (planId: string, payload: UpdatePlanRequest): Promise<PlanResponse> => {
    const response = await apiClient.put<PlanResponse>(`/api/v1/plans/${planId}`, payload);
    return response.data;
  },
};
