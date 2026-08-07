import { useState, useCallback, useEffect } from 'react';
import type {
  Subscription,
  TenantBillingStatus,
  SearchSubscriptionsParams,
  CreateSubscriptionPayload,
  UpdateSubscriptionPayload,
} from '../types/subscription.type';
import { subscriptionService } from '../services/subscription.service';
import { getErrorMessage } from '@/utils/errors';

export function useSubscription(initialParams?: SearchSubscriptionsParams) {
  const [billingStatus, setBillingStatus] = useState<TenantBillingStatus | null>(null);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(initialParams?.page || 1);
  const [limit] = useState(initialParams?.limit || 10);
  const [statusFilter, setStatusFilter] = useState<SearchSubscriptionsParams['status']>(initialParams?.status);
  
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Carrega os dados de faturamento do Tenant
   */
  const fetchBillingStatus = useCallback(async () => {
    try {
      const statusData = await subscriptionService.getBillingStatus();
      setBillingStatus(statusData);
    } catch (err: unknown) {
      const msg = getErrorMessage(err, 'Falha ao obter status de faturamento.');
      console.warn('[SubscriptionHook]', msg);
    }
  }, []);

  /**
   * Busca lista paginada de assinaturas
   */
  const fetchSubscriptions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await subscriptionService.searchSubscriptions({
        page,
        limit,
        status: statusFilter,
        payer_email: initialParams?.payer_email,
        preapproval_plan_id: initialParams?.preapproval_plan_id,
      });
      setSubscriptions(data.results);
      setTotal(data.paging.total);
    } catch (err) {
      setError(getErrorMessage(err, 'Falha ao buscar histórico de assinaturas.'));
    } finally {
      setLoading(false);
    }
  }, [page, limit, statusFilter, initialParams?.payer_email, initialParams?.preapproval_plan_id]);

  useEffect(() => {
    fetchBillingStatus();
    fetchSubscriptions();
  }, [fetchBillingStatus, fetchSubscriptions]);

  /**
   * Dispara criação de nova assinatura
   */
  const createSubscription = async (payload: CreateSubscriptionPayload) => {
    setActionLoading(true);
    setError(null);
    try {
      const newSub = await subscriptionService.createSubscription(payload);
      await fetchBillingStatus();
      await fetchSubscriptions();
      return newSub;
    } catch (err) {
      const msg = getErrorMessage(err, 'Erro ao criar assinatura no Mercado Pago.');
      setError(msg);
      throw new Error(msg);
    } finally {
      setActionLoading(false);
    }
  };

  /**
   * Atualiza dados de uma assinatura
   */
  const updateSubscription = async (id: string, payload: UpdateSubscriptionPayload) => {
    setActionLoading(true);
    setError(null);
    try {
      const updatedSub = await subscriptionService.updateSubscription(id, payload);
      setSubscriptions((prev) => prev.map((sub) => (sub.id === id ? updatedSub : sub)));
      await fetchBillingStatus();
      return updatedSub;
    } catch (err) {
      const msg = getErrorMessage(err, 'Erro ao atualizar assinatura.');
      setError(msg);
      throw new Error(msg);
    } finally {
      setActionLoading(false);
    }
  };

  /**
   * Sincroniza assinatura diretamente com o Mercado Pago
   */
  const syncSubscription = async (id: string) => {
    setActionLoading(true);
    setError(null);
    try {
      const syncedSub = await subscriptionService.getSubscriptionById(id, true);
      setSubscriptions((prev) => prev.map((sub) => (sub.id === id ? syncedSub : sub)));
      await fetchBillingStatus();
      return syncedSub;
    } catch (err) {
      const msg = getErrorMessage(err, 'Erro ao sincronizar assinatura com o Mercado Pago.');
      setError(msg);
      throw new Error(msg);
    } finally {
      setActionLoading(false);
    }
  };

  /**
   * Cancela assinatura recorrente
   */
  const cancelSubscription = async (id: string) => {
    setActionLoading(true);
    setError(null);
    try {
      const cancelledSub = await subscriptionService.cancelSubscription(id);
      setSubscriptions((prev) =>
        prev.map((sub) => (sub.id === id ? cancelledSub : sub))
      );
      await fetchBillingStatus();
      return cancelledSub;
    } catch (err) {
      const msg = getErrorMessage(err, 'Erro ao cancelar assinatura.');
      setError(msg);
      throw new Error(msg);
    } finally {
      setActionLoading(false);
    }
  };

  /**
   * Baixa arquivo CSV de exportação
   */
  const exportCsv = async () => {
    setActionLoading(true);
    setError(null);
    try {
      const blob = await subscriptionService.downloadCsvExport();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `assinaturas_tenant_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError(getErrorMessage(err, 'Erro ao baixar arquivo CSV.'));
    } finally {
      setActionLoading(false);
    }
  };

  return {
    billingStatus,
    subscriptions,
    total,
    page,
    setPage,
    limit,
    statusFilter,
    setStatusFilter,
    loading,
    actionLoading,
    error,
    setError,
    refresh: fetchSubscriptions,
    refreshBilling: fetchBillingStatus,
    createSubscription,
    updateSubscription,
    syncSubscription,
    cancelSubscription,
    exportCsv,
  };
}