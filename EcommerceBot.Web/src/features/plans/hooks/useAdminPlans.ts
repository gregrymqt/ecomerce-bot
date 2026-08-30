/**
 * src/features/plans/hooks/useAdminPlans.ts
 *
 * Hook reativo para gerenciar o estado do Painel Admin de Planos de Assinatura.
 */

import { useCallback, useEffect, useState } from 'react';
import { plansService } from '../services/plans.service';
import type { CreatePlanRequest, PlanResponse, UpdatePlanRequest } from '../types';
import type { AlertVariant } from '@/components/ui/feedback/Alert';
import { getErrorMessage } from '@/utils/errors';

export type PlanSourceMode = 'local' | 'mp';

export interface AdminPlanAlert {
  variant: AlertVariant;
  title?: string;
  message: string;
}

export interface UseAdminPlansReturn {
  sourceMode: PlanSourceMode;
  setSourceMode: (mode: PlanSourceMode) => void;
  plans: PlanResponse[];
  loading: boolean;
  error: string | null;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  statusFilter: string;
  setStatusFilter: (status: string) => void;
  isModalOpen: boolean;
  editingPlan: PlanResponse | null;
  submitting: boolean;
  alertInfo: AdminPlanAlert | null;
  clearAlert: () => void;
  openCreateModal: () => void;
  openEditModal: (plan: PlanResponse) => void;
  closeModal: () => void;
  handleSavePlan: (payload: CreatePlanRequest | UpdatePlanRequest) => Promise<void>;
  handleToggleStatus: (plan: PlanResponse) => Promise<void>;
  refreshPlans: () => Promise<void>;
}

export function useAdminPlans(): UseAdminPlansReturn {
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
      const data = await plansService.listPlans(false);
      let filtered = data;

      if (statusFilter !== 'all') {
        const isActiveFilter = statusFilter === 'active';
        filtered = filtered.filter((p) => (p.isActive ?? p.status === 'active') === isActiveFilter);
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        filtered = filtered.filter(
          (p) =>
            p.name?.toLowerCase().includes(q) ||
            p.reason?.toLowerCase().includes(q) ||
            p.id?.toLowerCase().includes(q) ||
            p.mpPreapprovalPlanId?.toLowerCase().includes(q) ||
            p.description?.toLowerCase().includes(q)
        );
      }

      setPlans(filtered);
    } catch (err: unknown) {
      const msg = getErrorMessage(err, 'Falha ao carregar planos de assinatura.');
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchQuery]);

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
        setAlertInfo({
          variant: 'success',
          title: 'Plano Atualizado',
          message: `O plano "${(payload as UpdatePlanRequest).name || editingPlan.name}" foi atualizado com sucesso.`,
        });
      } else {
        await plansService.createPlan(payload as CreatePlanRequest);
        setAlertInfo({
          variant: 'success',
          title: 'Plano Criado',
          message: `O novo plano "${(payload as CreatePlanRequest).name}" foi cadastrado com sucesso.`,
        });
      }
      closeModal();
      await fetchPlans();
    } catch (err: unknown) {
      const msg = getErrorMessage(err, 'Erro ao salvar o plano.');
      throw new Error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (plan: PlanResponse) => {
    const isCurrentlyActive = plan.isActive ?? plan.status === 'active';
    const newStatus = !isCurrentlyActive;
    const planName = plan.name || plan.reason || 'Plano';
    const confirmMsg = `Deseja ${newStatus ? 'ativar' : 'desativar'} o plano "${planName}"?`;
    if (!window.confirm(confirmMsg)) return;

    setLoading(true);
    try {
      await plansService.updatePlan(plan.id, { isActive: newStatus });
      setAlertInfo({
        variant: 'success',
        title: 'Status Alterado',
        message: `O status do plano "${planName}" foi alterado para ${newStatus ? 'Ativo' : 'Inativo'}.`,
      });
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

export default useAdminPlans;
