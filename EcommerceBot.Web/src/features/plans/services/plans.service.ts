/**
 * src/features/plans/services/plans.service.ts
 *
 * Camada de serviços HTTP para consumo dos endpoints de Gestão de Planos (/api/v1/plans/*).
 * Integrado com o apiClient do projeto e a API ASP.NET Core.
 */

import { apiClient } from '@/lib/apiClient';
import { getErrorMessage } from '@/utils/errors';
import type {
  CreatePlanRequest,
  PlanResponse,
  PlanSearchResponse,
  SearchPlansQueryParams,
  UpdatePlanRequest,
} from '../types';

export const plansService = {
  /**
   * Lista todos os planos de assinatura cadastrados no banco de dados.
   * Rota: GET /api/v1/plans?onlyActive={onlyActive}
   */
  listPlans: async (onlyActive = false): Promise<PlanResponse[]> => {
    try {
      const response = await apiClient.get<PlanResponse[]>('/api/v1/plans', {
        params: { onlyActive },
      });
      return response.data;
    } catch (error: unknown) {
      const msg = getErrorMessage(error, 'Falha ao listar planos de assinatura.');
      throw new Error(msg);
    }
  },

  /**
   * Obtém detalhes de um plano pelo ID Guid.
   * Rota: GET /api/v1/plans/{id}
   */
  getPlanById: async (id: string): Promise<PlanResponse> => {
    try {
      const response = await apiClient.get<PlanResponse>(`/api/v1/plans/${id}`);
      return response.data;
    } catch (error: unknown) {
      const msg = getErrorMessage(error, 'Erro ao consultar detalhes do plano.');
      throw new Error(msg);
    }
  },

  /**
   * Cria um novo plano de assinatura no sistema.
   * Rota: POST /api/v1/plans
   */
  createPlan: async (payload: CreatePlanRequest): Promise<PlanResponse> => {
    try {
      const response = await apiClient.post<PlanResponse>('/api/v1/plans', payload);
      return response.data;
    } catch (error: unknown) {
      const msg = getErrorMessage(error, 'Erro ao cadastrar novo plano.');
      throw new Error(msg);
    }
  },

  /**
   * Atualiza as configurações de um plano de assinatura existente.
   * Rota: PUT /api/v1/plans/{id}
   */
  updatePlan: async (id: string, payload: UpdatePlanRequest): Promise<PlanResponse> => {
    try {
      const response = await apiClient.put<PlanResponse>(`/api/v1/plans/${id}`, payload);
      return response.data;
    } catch (error: unknown) {
      const msg = getErrorMessage(error, 'Erro ao atualizar plano.');
      throw new Error(msg);
    }
  },

  /**
   * Alias de compatibilidade para listagem local.
   */
  listLocalPlans: async (limit = 100, _offset = 0): Promise<PlanResponse[]> => {
    const plans = await plansService.listPlans(false);
    return plans.slice(0, limit);
  },

  /**
   * Alias de compatibilidade para busca de planos.
   */
  searchMpPlans: async (params?: SearchPlansQueryParams): Promise<PlanSearchResponse> => {
    const plans = await plansService.listPlans(false);
    let filtered = plans;

    if (params?.status && params.status !== 'all') {
      const isActiveFilter = params.status.toLowerCase() === 'active';
      filtered = filtered.filter((p) => p.isActive === isActiveFilter);
    }

    if (params?.q?.trim()) {
      const q = params.q.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.name?.toLowerCase().includes(q) ||
          p.id?.toLowerCase().includes(q) ||
          p.mpPreapprovalPlanId?.toLowerCase().includes(q) ||
          p.description?.toLowerCase().includes(q)
      );
    }

    const offset = params?.offset ?? 0;
    const limit = params?.limit ?? 50;
    const paginated = filtered.slice(offset, offset + limit);

    return {
      paging: {
        offset,
        limit,
        total: filtered.length,
      },
      results: paginated,
    };
  },

  /**
   * Alias de compatibilidade para buscar plano por ID externo.
   */
  getPlanByExternalId: async (externalId: string): Promise<PlanResponse> => {
    const plans = await plansService.listPlans(false);
    const found = plans.find(
      (p) => p.mpPreapprovalPlanId === externalId || p.id === externalId
    );
    if (!found) {
      throw new Error('Plano não encontrado.');
    }
    return found;
  },
};

export default plansService;
