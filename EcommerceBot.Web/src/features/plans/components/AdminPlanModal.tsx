/**
 * src/features/plans/components/AdminPlanModal.tsx
 *
 * Modal padronizado para criação e edição de planos de assinatura.
 * Em conformidade com acessibilidade WCAG 2.1 AA, inputs >= 16px e touch targets >= 44px.
 */

import React, { useState } from 'react';
import { Sparkles, AlertCircle } from 'lucide-react';
import { Modal, Button, Input } from '@/components/ui';
import type { CreatePlanRequest, PlanResponse, UpdatePlanRequest } from '../types';
import { getErrorMessage } from '@/utils/errors';

export interface AdminPlanModalProps {
  isOpen: boolean;
  editingPlan: PlanResponse | null;
  submitting: boolean;
  onClose: () => void;
  onSave: (payload: CreatePlanRequest | UpdatePlanRequest) => Promise<void>;
}

export const AdminPlanModal: React.FC<AdminPlanModalProps> = ({
  isOpen,
  editingPlan,
  submitting,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState(() => editingPlan?.name || editingPlan?.reason || '');
  const [description, setDescription] = useState(() => editingPlan?.description || '');
  const [price, setPrice] = useState<number | ''>(() => editingPlan?.price ?? editingPlan?.auto_recurring?.transaction_amount ?? 49.9);
  const [creditsIncluded, setCreditsIncluded] = useState<number | ''>(() => editingPlan?.creditsIncluded ?? 1000);
  const [billingInterval, setBillingInterval] = useState(() => editingPlan?.billingInterval || 'MONTHLY');
  const [trialDays, setTrialDays] = useState<number | ''>(() => editingPlan?.trialDays ?? editingPlan?.auto_recurring?.free_trial?.frequency ?? 7);
  const [mpPreapprovalPlanId, setMpPreapprovalPlanId] = useState(() => editingPlan?.mpPreapprovalPlanId || editingPlan?.external_id || '');
  const [isActive, setIsActive] = useState(() => editingPlan?.isActive ?? (editingPlan ? editingPlan.status === 'active' : true));
  const [formError, setFormError] = useState<string | null>(null);

  const isEditMode = Boolean(editingPlan);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!name.trim()) {
      setFormError('Por favor informe o nome do plano.');
      return;
    }

    if (typeof price !== 'number' || price < 0) {
      setFormError('Informe um valor de preço válido maior ou igual a zero.');
      return;
    }

    try {
      if (isEditMode) {
        const payload: UpdatePlanRequest = {
          name: name.trim(),
          description: description.trim() || undefined,
          price: price as number,
          creditsIncluded: typeof creditsIncluded === 'number' ? creditsIncluded : 0,
          billingInterval,
          trialDays: typeof trialDays === 'number' ? trialDays : 0,
          mpPreapprovalPlanId: mpPreapprovalPlanId.trim() || undefined,
          isActive,
        };
        await onSave(payload);
      } else {
        const payload: CreatePlanRequest = {
          name: name.trim(),
          description: description.trim() || undefined,
          price: price as number,
          creditsIncluded: typeof creditsIncluded === 'number' ? creditsIncluded : 0,
          billingInterval,
          trialDays: typeof trialDays === 'number' ? trialDays : 0,
          mpPreapprovalPlanId: mpPreapprovalPlanId.trim() || undefined,
          isActive,
        };
        await onSave(payload);
      }
    } catch (err: unknown) {
      setFormError(getErrorMessage(err, 'Erro ao processar a requisição do plano.'));
    }
  };

  const footerActions = (
    <div className="flex flex-col sm:flex-row items-center justify-end gap-3 w-full">
      <Button
        type="button"
        variant="secondary"
        onClick={onClose}
        disabled={submitting}
        className="w-full sm:w-auto min-h-[44px]"
      >
        Cancelar
      </Button>

      <Button
        type="button"
        variant="primary"
        onClick={handleSubmit}
        disabled={submitting}
        isLoading={submitting}
        iconLeft={!submitting ? <Sparkles className="w-4 h-4" /> : undefined}
        className="w-full sm:w-auto min-h-[44px] bg-indigo-600 hover:bg-indigo-500 font-bold text-white shadow-lg shadow-indigo-600/25"
      >
        {isEditMode ? 'Atualizar Plano' : 'Criar Novo Plano'}
      </Button>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditMode ? 'Editar Plano de Assinatura' : 'Criar Novo Plano de Assinatura'}
      description={
        isEditMode
          ? `Atualizando configurações do ID: ${editingPlan?.id}`
          : 'Cadastre um novo plano para disponibilização aos lojistas.'
      }
      size="lg"
      footer={footerActions}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {formError && (
          <div
            role="alert"
            className="flex items-center gap-3 p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-300 text-sm"
          >
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        <div>
          <label htmlFor="plan-name-input" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider font-mono mb-1.5">
            Nome do Plano *
          </label>
          <Input
            id="plan-name-input"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Plano Pro Mensal"
            disabled={submitting}
            className="text-base min-h-[44px]"
            required
          />
        </div>

        <div>
          <label htmlFor="plan-desc-input" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider font-mono mb-1.5">
            Descrição do Plano
          </label>
          <Input
            id="plan-desc-input"
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ex: Ideal para lojas em crescimento com alto volume de produtos"
            disabled={submitting}
            className="text-base min-h-[44px]"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="plan-price-input" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider font-mono mb-1.5">
              Valor Recorrente (R$) *
            </label>
            <Input
              id="plan-price-input"
              type="number"
              step="0.01"
              min="0"
              value={price}
              onChange={(e) => setPrice(e.target.value ? parseFloat(e.target.value) : '')}
              placeholder="49.90"
              disabled={submitting}
              className="text-base min-h-[44px] font-mono"
              required
            />
          </div>

          <div>
            <label htmlFor="plan-credits-input" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider font-mono mb-1.5">
              Créditos de IA Inclusos
            </label>
            <Input
              id="plan-credits-input"
              type="number"
              min="0"
              value={creditsIncluded}
              onChange={(e) => setCreditsIncluded(e.target.value ? parseInt(e.target.value) : '')}
              placeholder="1000"
              disabled={submitting}
              className="text-base min-h-[44px] font-mono"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="plan-interval-select" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider font-mono mb-1.5">
              Intervalo de Cobrança
            </label>
            <select
              id="plan-interval-select"
              value={billingInterval}
              onChange={(e) => setBillingInterval(e.target.value)}
              disabled={submitting}
              className="w-full min-h-[44px] px-3 bg-slate-900 border border-slate-800 rounded-xl text-slate-100 text-base outline-none focus:border-indigo-500 font-mono"
            >
              <option value="MONTHLY">Mensal (MONTHLY)</option>
              <option value="YEARLY">Anual (YEARLY)</option>
              <option value="WEEKLY">Semanal (WEEKLY)</option>
            </select>
          </div>

          <div>
            <label htmlFor="plan-trial-input" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider font-mono mb-1.5">
              Dias de Teste Grátis (Trial)
            </label>
            <Input
              id="plan-trial-input"
              type="number"
              min="0"
              value={trialDays}
              onChange={(e) => setTrialDays(e.target.value ? parseInt(e.target.value) : '')}
              placeholder="7"
              disabled={submitting}
              className="text-base min-h-[44px] font-mono"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="plan-mp-input" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider font-mono mb-1.5">
              ID Mercado Pago Preapproval (Opcional)
            </label>
            <Input
              id="plan-mp-input"
              type="text"
              value={mpPreapprovalPlanId}
              onChange={(e) => setMpPreapprovalPlanId(e.target.value)}
              placeholder="Ex: 2c938084..."
              disabled={submitting}
              className="text-base min-h-[44px] font-mono"
            />
          </div>

          <div>
            <label htmlFor="plan-status-select" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider font-mono mb-1.5">
              Status do Plano
            </label>
            <select
              id="plan-status-select"
              value={isActive ? 'active' : 'inactive'}
              onChange={(e) => setIsActive(e.target.value === 'active')}
              disabled={submitting}
              className="w-full min-h-[44px] px-3 bg-slate-900 border border-slate-800 rounded-xl text-slate-100 text-base outline-none focus:border-indigo-500 font-mono"
            >
              <option value="active">Ativo (Visível para assinatura)</option>
              <option value="inactive">Inativo (Bloqueia novas assinaturas)</option>
            </select>
          </div>
        </div>
      </form>
    </Modal>
  );
};

export default AdminPlanModal;
