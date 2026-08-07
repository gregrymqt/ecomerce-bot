/**
 * src/features/plans/hooks/useAdminPlans.ts
 * Hook reativo para gerenciar o estado do Painel Admin de Planos de Assinatura.
 */

import { useCallback, useEffect, useState } from 'react';
import { plansService } from '../services/plans.service';
import type { CreatePlanRequest, PlanResponse, UpdatePlanRequest } from '../types/plans.type';
import type { AlertVariant } from '@/components/ui/feedback/Alert';
import { getErrorMessage } from '@/utils/errors';

export type PlanSourceMode = 'local' | 'mp';

export interface AdminPlanAlert {
  variant: AlertVariant;
  title?: string;
  message: string;
}

export function useAdminPlans() {
  const [sourceMode, setSourceMode] = useState<PlanSourceMode>('local');
  const [plans, setPlans] = useState<PlanResponse[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Estado de Alerta Customizado para UI Feedback
  const [alertInfo, setAlertInfo] = useState<AdminPlanAlert | null>(null);
  const clearAlert = () => setAlertInfo(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingPlan, setEditingPlan] = useState<PlanResponse | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const fetchPlans = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (sourceMode === 'local') {
        const data = await plansService.listLocalPlans(100, 0);
        let filtered = data;
        if (statusFilter !== 'all') {
          filtered = filtered.filter((p) => p.status?.toLowerCase() === statusFilter.toLowerCase());
        }
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          filtered = filtered.filter(
            (p) =>
              p.reason?.toLowerCase().includes(q) ||
              p.id?.toLowerCase().includes(q) ||
              p.external_id?.toLowerCase().includes(q)
          );
        }
        setPlans(filtered);
      } else {
        const response = await plansService.searchMpPlans({
          status: statusFilter !== 'all' ? statusFilter : undefined,
          q: searchQuery.trim() || undefined,
          limit: 50,
          offset: 0,
        });
        setPlans(response.results || []);
      }
    } catch (err: unknown) {
      const msg = getErrorMessage(err, 'Falha ao carregar planos de assinatura.');
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [sourceMode, statusFilter, searchQuery]);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  const openCreateModal = () => {
    setEditingPlan(null);
    setIsModalOpen(true);
  };

  const openEditModal = (plan: PlanResponse) => {
    setEditingPlan(plan);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingPlan(null);
  };

  const handleSavePlan = async (payload: CreatePlanRequest | UpdatePlanRequest) => {
    setSubmitting(true);
    setError(null);
    try {
      if (editingPlan) {
        await plansService.updatePlan(editingPlan.id, payload as UpdatePlanRequest);
      } else {
        await plansService.createPlan(payload as CreatePlanRequest);
      }
      closeModal();
      await fetchPlans();
    } catch (err: unknown) {
      const msg = getErrorMessage(err, 'Erro ao salvar o plano no Mercado Pago.');
      throw new Error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (plan: PlanResponse) => {
    const newStatus = plan.status === 'active' ? 'canceled' : 'active';
    const confirmMsg = `Deseja alterar o status do plano "${plan.reason}" para ${newStatus === 'active' ? 'Ativo' : 'Cancelado'}?`;
    if (!window.confirm(confirmMsg)) return;

    setLoading(true);
    try {
      await plansService.updatePlan(plan.id, { status: newStatus });
      await fetchPlans();
    } catch (err: unknown) {
      const msg = getErrorMessage(err, 'Falha ao atualizar status do plano.');
      setAlertInfo({
        variant: 'error',
        title: 'Erro de Status do Plano',
        message: msg,
      });
    } finally {
      setLoading(false);
    }
  };

  return {
    sourceMode,
    setSourceMode,
    plans,
    loading,
    error,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    isModalOpen,
    editingPlan,
    submitting,
    alertInfo,
    clearAlert,
    openCreateModal,
    openEditModal,
    closeModal,
    handleSavePlan,
    handleToggleStatus,
    refreshPlans: fetchPlans,
  };
}
