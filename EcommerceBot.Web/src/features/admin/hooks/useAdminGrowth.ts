/**
 * src/features/admin/hooks/useAdminGrowth.ts
 *
 * Hook de gerenciamento de estado e operações do painel de Growth e Unit Economics.
 */

import { useState, useEffect, useCallback } from 'react';
import { adminGrowthService } from '../services/adminGrowth.service';
import type {
  AcquisitionFunnelData,
  UnitEconomicsData,
  CreateAdSpendPayload,
} from '../types/growth.types';
import { getErrorMessage } from '@/utils/errors';

const initialFormData = (): CreateAdSpendPayload => ({
  campaign_name: '',
  utm_source: 'meta_ads',
  ad_id: '',
  amount_spent_brl: 0,
  period_start: new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0],
  period_end: new Date().toISOString().split('T')[0],
  notes: '',
});

export const useAdminGrowth = () => {
  const [days, setDays] = useState<number>(30);
  const [loading, setLoading] = useState<boolean>(true);
  const [funnel, setFunnel] = useState<AcquisitionFunnelData | null>(null);
  const [unitEconomics, setUnitEconomics] = useState<UnitEconomicsData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Modal e Form de Ad Spend
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [submittingSpend, setSubmittingSpend] = useState<boolean>(false);
  const [spendError, setSpendError] = useState<string | null>(null);
  const [formData, setFormData] = useState<CreateAdSpendPayload>(initialFormData());

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [funnelRes, economicsRes] = await Promise.all([
        adminGrowthService.getAcquisitionFunnel(days),
        adminGrowthService.getUnitEconomics(days),
      ]);
      setFunnel(funnelRes);
      setUnitEconomics(economicsRes);
    } catch (err: unknown) {
      const msg = getErrorMessage(err, 'Erro ao carregar métricas de growth.');
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const resetForm = () => {
    setFormData(initialFormData());
    setSpendError(null);
  };

  const handleCreateAdSpend = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingSpend(true);
    setSpendError(null);
    try {
      await adminGrowthService.createAdSpend(formData);
      setIsModalOpen(false);
      resetForm();
      await fetchData();
    } catch (err: unknown) {
      const msg = getErrorMessage(err, 'Erro ao salvar gasto em ads.');
      setSpendError(msg);
    } finally {
      setSubmittingSpend(false);
    }
  };

  return {
    days,
    setDays,
    loading,
    funnel,
    unitEconomics,
    error,
    isModalOpen,
    setIsModalOpen,
    submittingSpend,
    spendError,
    formData,
    setFormData,
    handleCreateAdSpend,
    fetchData,
    resetForm,
  };
};

export default useAdminGrowth;
