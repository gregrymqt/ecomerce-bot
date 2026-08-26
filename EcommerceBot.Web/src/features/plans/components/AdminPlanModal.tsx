/**
 * src/features/plans/components/AdminPlanModal.tsx
 * Modal fluida para criação e edição de planos de assinatura integrados ao Mercado Pago (Synthetica Dark).
 */

import React, { useEffect, useState } from 'react';
import { X, Sparkles, AlertCircle, RefreshCw, Lock } from 'lucide-react';
import type { CreatePlanRequest, PlanResponse, UpdatePlanRequest } from '@/features/plans';
import { getErrorMessage } from '@/utils/errors';

interface AdminPlanModalProps {
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
  const [reason, setReason] = useState('');
  const [externalId, setExternalId] = useState('');
  const [amount, setAmount] = useState<number | ''>(49.9);
  const [frequency, setFrequency] = useState(1);
  const [frequencyType, setFrequencyType] = useState<'months' | 'days'>('months');
  const [trialDays, setTrialDays] = useState<number | ''>(7);
  const [status, setStatus] = useState<'active' | 'canceled'>('active');
  const [formError, setFormError] = useState<string | null>(null);

  const isEditMode = Boolean(editingPlan);

  useEffect(() => {
    if (editingPlan) {
      setReason(editingPlan.reason || '');
      setExternalId(editingPlan.external_id || '');
      setAmount(editingPlan.auto_recurring?.transaction_amount ?? 49.9);
      setFrequency(editingPlan.auto_recurring?.frequency ?? 1);
      setFrequencyType(
        (editingPlan.auto_recurring?.frequency_type as 'months' | 'days') || 'months'
      );
      setTrialDays(editingPlan.auto_recurring?.free_trial?.frequency ?? '');
      setStatus(editingPlan.status === 'canceled' ? 'canceled' : 'active');
    } else {
      setReason('');
      setExternalId('');
      setAmount(49.9);
      setFrequency(1);
      setFrequencyType('months');
      setTrialDays(7);
      setStatus('active');
    }
    setFormError(null);
  }, [editingPlan, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!reason.trim()) {
      setFormError('Por favor informe o nome/razão do plano.');
      return;
    }

    if (!isEditMode && (typeof amount !== 'number' || amount <= 0)) {
      setFormError('Informe um valor numérico maior que zero.');
      return;
    }

    try {
      if (isEditMode) {
        // Na API de Preapproval do Mercado Pago, apenas o nome (reason), status e external_id podem ser atualizados
        const payload: UpdatePlanRequest = {
          reason: reason.trim(),
          external_id: externalId.trim() || undefined,
          status,
        };
        await onSave(payload);
      } else {
        const payload: CreatePlanRequest = {
          reason: reason.trim(),
          external_id: externalId.trim() || undefined,
          auto_recurring: {
            transaction_amount: amount as number,
            currency_id: 'BRL',
            frequency,
            frequency_type: frequencyType,
            free_trial:
              trialDays && typeof trialDays === 'number' && trialDays > 0
                ? { frequency: trialDays, frequency_type: 'days' }
                : undefined,
          },
        };
        await onSave(payload);
      }
    } catch (err: unknown) {
      setFormError(getErrorMessage(err, 'Erro ao processar requisição.'));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-[#15121B] border border-indigo-500/20 rounded-3xl shadow-2xl shadow-indigo-950/50 overflow-hidden text-slate-100">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800/80 bg-[#100D14]/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl text-indigo-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100">
                {isEditMode ? 'Editar Plano de Assinatura' : 'Criar Novo Plano Mercado Pago'}
              </h2>
              <p className="text-xs text-slate-400 font-mono">
                {isEditMode
                  ? `Atualizando configurações do ID: ${editingPlan?.id}`
                  : 'Sincronização automática com Mercado Pago REST API'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            aria-label="Fechar modal"
            className="p-2.5 min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body / Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {formError && (
            <div className="flex items-center gap-3 p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-300 text-sm">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {isEditMode && (
            <div className="flex items-start gap-3 p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-amber-300 text-xs font-mono">
              <Lock className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
              <span>
                <strong>Restrição Mercado Pago:</strong> O valor recorrente, a frequência e a moeda são imutáveis após a ativação do plano. Apenas o Nome e o Status podem ser alterados.
              </span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider font-mono mb-1.5">
              Nome do Plano (Razão Fatura MP) *
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex: Plano Pro Mensal - E-commerce Bot"
              className="w-full min-h-[44px] px-4 bg-[#100D14] border border-slate-800 rounded-xl text-slate-100 text-base focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-colors"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="flex items-center text-xs font-semibold text-slate-300 uppercase tracking-wider font-mono mb-1.5">
                Valor Recorrente (R$) *
                {isEditMode && (
                  <span title="Campo imutável no Mercado Pago">
                    <Lock className="w-3 h-3 text-amber-400 ml-1.5" />
                  </span>
                )}
              </label>
              <input
                type="number"
                step="0.01"
                min="1"
                value={amount}
                disabled={isEditMode}
                onChange={(e) => setAmount(e.target.value ? parseFloat(e.target.value) : '')}
                placeholder="49.90"
                className="w-full min-h-[44px] px-4 bg-[#100D14] border border-slate-800 rounded-xl text-slate-100 text-base focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-colors disabled:opacity-50 disabled:bg-[#100D14]/80 disabled:cursor-not-allowed font-mono"
                required={!isEditMode}
              />
            </div>

            <div>
              <label className="flex items-center text-xs font-semibold text-slate-300 uppercase tracking-wider font-mono mb-1.5">
                ID Externo / Referência
                {isEditMode && (
                  <span title="Campo imutável no Mercado Pago">
                    <Lock className="w-3 h-3 text-amber-400 ml-1.5" />
                  </span>
                )}
              </label>
              <input
                type="text"
                value={externalId}
                disabled={isEditMode}
                onChange={(e) => setExternalId(e.target.value)}
                placeholder="Ex: plan_pro_v1"
                className="w-full min-h-[44px] px-4 bg-[#100D14] border border-slate-800 rounded-xl text-slate-100 text-base focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-colors font-mono disabled:opacity-50 disabled:bg-[#100D14]/80 disabled:cursor-not-allowed"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="flex items-center text-xs font-semibold text-slate-300 uppercase tracking-wider font-mono mb-1.5">
                Frequência de Cobrança
                {isEditMode && (
                  <span title="Campo imutável no Mercado Pago">
                    <Lock className="w-3 h-3 text-amber-400 ml-1.5" />
                  </span>
                )}
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="1"
                  value={frequency}
                  disabled={isEditMode}
                  onChange={(e) => setFrequency(parseInt(e.target.value) || 1)}
                  className="w-20 min-h-[44px] px-3 bg-[#100D14] border border-slate-800 rounded-xl text-slate-100 text-base outline-none disabled:opacity-50 disabled:bg-[#100D14]/80 disabled:cursor-not-allowed font-mono"
                  required={!isEditMode}
                />
                <select
                  value={frequencyType}
                  disabled={isEditMode}
                  onChange={(e) => setFrequencyType(e.target.value as 'months' | 'days')}
                  className="flex-1 min-h-[44px] px-3 bg-[#100D14] border border-slate-800 rounded-xl text-slate-100 text-base outline-none disabled:opacity-50 disabled:bg-[#100D14]/80 disabled:cursor-not-allowed font-mono"
                >
                  <option value="months">Mês(es)</option>
                  <option value="days">Dia(s)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="flex items-center text-xs font-semibold text-slate-300 uppercase tracking-wider font-mono mb-1.5">
                Dias de Teste Grátis (Trial)
                {isEditMode && (
                  <span title="Campo imutável no Mercado Pago">
                    <Lock className="w-3 h-3 text-amber-400 ml-1.5" />
                  </span>
                )}
              </label>
              <input
                type="number"
                min="0"
                value={trialDays}
                disabled={isEditMode}
                onChange={(e) => setTrialDays(e.target.value ? parseInt(e.target.value) : '')}
                placeholder="0"
                className="w-full min-h-[44px] px-4 bg-[#100D14] border border-slate-800 rounded-xl text-slate-100 text-base focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-colors disabled:opacity-50 disabled:bg-[#100D14]/80 disabled:cursor-not-allowed font-mono"
              />
            </div>
          </div>

          {isEditMode && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider font-mono mb-1.5">
                Status no Mercado Pago
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as 'active' | 'canceled')}
                className="w-full min-h-[44px] px-4 bg-[#100D14] border border-slate-800 rounded-xl text-slate-100 text-base outline-none focus:border-indigo-500 font-mono"
              >
                <option value="active">Ativo (Permite novas assinaturas)</option>
                <option value="canceled">Cancelado (Bloqueia novas contratações)</option>
              </select>
            </div>
          )}

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800/80">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="min-h-[44px] min-w-[44px] px-5 py-2.5 bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 rounded-xl text-sm font-medium transition-colors border border-slate-700/50 flex items-center justify-center"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="min-h-[44px] min-w-[44px] px-6 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-xl text-sm font-semibold shadow-lg shadow-indigo-500/25 transition-all flex items-center justify-center gap-2 border border-indigo-400/20"
            >
              {submitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" /> Salvando...
                </>
              ) : (
                <>{isEditMode ? 'Atualizar Plano' : 'Criar e Sincronizar'}</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};


