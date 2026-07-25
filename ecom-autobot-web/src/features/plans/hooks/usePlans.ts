import { useState, useCallback, useEffect } from 'react';
import type {
  Plan,
  CreatePlanPayload,
  UpdatePlanPayload,
  SearchPlansParams,
} from '../types/plan.type';
import { planService } from '../services/plan.service';
import { getErrorMessage } from '@/utils/errors';

interface UsePlansOptions {
  isAdmin?: boolean;
  autoFetch?: boolean;
}

export function usePlans(options: UsePlansOptions = { isAdmin: false, autoFetch: true }) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Carrega os planos de acordo com a função do usuário
   */
  const fetchPlans = useCallback(async (params?: SearchPlansParams) => {
    setLoading(true);
    setError(null);
    try {
      if (options.isAdmin) {
        const data = await planService.getLocalPlans(params?.limit || 50, params?.offset || 0);
        setPlans(data);
        setTotal(data.length);
      } else {
        const data = await planService.getPublicPlans();
        setPlans(data);
        setTotal(data.length);
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Falha ao carregar catálogo de planos.'));
    } finally {
      setLoading(false);
    }
  }, [options.isAdmin]);

  useEffect(() => {
    if (options.autoFetch) {
      fetchPlans();
    }
  }, [fetchPlans, options.autoFetch]);

  /**
   * [Ação Admin] Cria novo plano de assinatura
   */
  const createPlan = async (payload: CreatePlanPayload) => {
    setActionLoading(true);
    setError(null);
    try {
      const newPlan = await planService.createPlan(payload);
      setPlans((prev) => [newPlan, ...prev]);
      return newPlan;
    } catch (err) {
      const msg = getErrorMessage(err, 'Erro ao criar plano de assinatura.');
      setError(msg);
      throw new Error(msg);
    } finally {
      setActionLoading(false);
    }
  };

  /**
   * [Ação Admin] Atualiza um plano
   */
  const updatePlan = async (planId: string, payload: UpdatePlanPayload) => {
    setActionLoading(true);
    setError(null);
    try {
      const updated = await planService.updatePlan(planId, payload);
      setPlans((prev) => prev.map((p) => (p.id === planId ? updated : p)));
      return updated;
    } catch (err) {
      const msg = getErrorMessage(err, 'Erro ao atualizar plano.');
      setError(msg);
      throw new Error(msg);
    } finally {
      setActionLoading(false);
    }
  };

  /**
   * [Ação Admin] Cancela/Inativa um plano
   */
  const cancelPlan = async (planId: string) => {
    return updatePlan(planId, { status: 'canceled' });
  };

  return {
    plans,
    total,
    loading,
    actionLoading,
    error,
    refresh: fetchPlans,
    createPlan,
    updatePlan,
    cancelPlan,
  };
}