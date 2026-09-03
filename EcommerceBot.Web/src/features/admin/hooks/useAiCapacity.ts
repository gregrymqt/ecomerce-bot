import { useState, useEffect, useCallback } from 'react';
import { aiCapacityService } from '../services/aiCapacity.service';
import type {
  AiCapacityOverviewResponse,
  AiCreditTopupPayload,
} from '../types/aiCapacity.types';
import { getErrorMessage } from '@/utils/errors';

const INITIAL_TOPUP_FORM: AiCreditTopupPayload = {
  provider: 'DEEPSEEK',
  amountPaid: 20,
  currency: 'USD',
  tokensCredited: 5000000,
  transactionReference: '',
  notes: '',
};

export function useAiCapacity() {
  const [days, setDays] = useState<number>(30);
  const [loading, setLoading] = useState<boolean>(true);
  const [overview, setOverview] = useState<AiCapacityOverviewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [triggering, setTriggering] = useState<boolean>(false);
  const [topupLoading, setTopupLoading] = useState<boolean>(false);
  const [isTopupModalOpen, setIsTopupModalOpen] = useState<boolean>(false);
  const [topupForm, setTopupForm] = useState<AiCreditTopupPayload>(INITIAL_TOPUP_FORM);

  const fetchOverview = useCallback(async (horizonDays: number) => {
    setLoading(true);
    setError(null);
    try {
      const data = await aiCapacityService.getOverview(horizonDays);
      setOverview(data);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Erro ao carregar telemetria de capacidade de IA.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOverview(days);
  }, [days, fetchOverview]);

  const handleTriggerForecast = async () => {
    setTriggering(true);
    try {
      await aiCapacityService.triggerRecalculation();
      await fetchOverview(days);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Falha ao enfileirar recálculo de capacidade de IA.'));
    } finally {
      setTriggering(false);
    }
  };

  const setTopupFormField = <K extends keyof AiCreditTopupPayload>(
    field: K,
    value: AiCreditTopupPayload[K]
  ) => {
    setTopupForm((prev) => ({ ...prev, [field]: value }));
  };

  const openTopupModal = () => {
    setTopupForm(INITIAL_TOPUP_FORM);
    setIsTopupModalOpen(true);
  };

  const closeTopupModal = () => {
    setIsTopupModalOpen(false);
  };

  const submitTopupForm = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (topupForm.amountPaid <= 0) return;

    setTopupLoading(true);
    try {
      await aiCapacityService.registerTopup(topupForm);
      setIsTopupModalOpen(false);
      setTopupForm(INITIAL_TOPUP_FORM);
      await fetchOverview(days);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Erro ao registrar recarga de créditos.'));
    } finally {
      setTopupLoading(false);
    }
  };

  return {
    days,
    setDays,
    loading,
    overview,
    error,
    triggering,
    topupLoading,
    isTopupModalOpen,
    topupForm,
    openTopupModal,
    closeTopupModal,
    setTopupFormField,
    submitTopupForm,
    fetchOverview,
    handleTriggerForecast,
  };
}
