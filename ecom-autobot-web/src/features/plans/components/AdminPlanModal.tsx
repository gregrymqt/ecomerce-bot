import React, { useState, useEffect } from 'react';
import { Clock, Link, Sparkles, Layers } from 'lucide-react';
import type { CreatePlanPayload, FrequencyType, Plan } from '../types/plan.type';
import { Modal } from '@/components/ui/overlay/Modal';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/feedback/Alert';

export interface AdminPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: CreatePlanPayload) => Promise<void>;
  isLoading?: boolean;
  initialPlan?: Plan | null;
}

export const AdminPlanModal: React.FC<AdminPlanModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  isLoading = false,
  initialPlan = null,
}) => {
  const [reason, setReason] = useState('');
  const [amount, setAmount] = useState<string>('99.90');
  const [frequency, setFrequency] = useState<number>(1);
  const [frequencyType, setFrequencyType] = useState<FrequencyType>('months');
  const [freeTrialDays, setFreeTrialDays] = useState<string>('0');
  const [backUrl, setBackUrl] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (initialPlan) {
      const auto = initialPlan.auto_recurring as any;
      setReason(initialPlan.reason || '');
      setAmount(auto?.transaction_amount?.toString() || '99.90');
      setFrequency(auto?.frequency || 1);
      setFrequencyType(auto?.frequency_type || 'months');
      setFreeTrialDays(auto?.free_trial?.frequency?.toString() || '0');
      setBackUrl(initialPlan.back_url || '');
    } else {
      setReason('');
      setAmount('99.90');
      setFrequency(1);
      setFrequencyType('months');
      setFreeTrialDays('0');
      setBackUrl('');
    }
    setErrorMsg(null);
  }, [initialPlan, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const parsedAmount = parseFloat(amount.replace(',', '.'));
    if (!reason.trim()) {
      setErrorMsg('O nome do plano é obrigatório.');
      return;
    }

    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setErrorMsg('Informe um valor de mensalidade válido e maior que zero.');
      return;
    }

    if (frequency <= 0) {
      setErrorMsg('A frequência de cobrança deve ser no mínimo 1.');
      return;
    }

    const trialDays = parseInt(freeTrialDays, 10);

    const payload: CreatePlanPayload = {
      reason: reason.trim(),
      auto_recurring: {
        frequency,
        frequency_type: frequencyType,
        transaction_amount: parsedAmount,
        currency_id: 'BRL',
        ...(trialDays > 0
          ? {
              free_trial: {
                frequency: trialDays,
                frequency_type: 'days',
              },
            }
          : {}),
      },
      ...(backUrl.trim() ? { back_url: backUrl.trim() } : {}),
    };

    try {
      await onSubmit(payload);
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Falha ao salvar plano.');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={isLoading ? () => {} : onClose}
      title={initialPlan ? 'Editar Plano de Assinatura' : 'Criar Novo Plano Recorrente'}
      description="Configure os parâmetros de cobrança Mercado Pago Preapproval para este plano."
      size="lg"
      footer={
        <div className="flex items-center justify-end gap-3 w-full">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
            className="h-11 min-h-[44px] px-5 text-sm font-semibold"
          >
            Cancelar
          </Button>

          <Button
            type="submit"
            form="admin-plan-form"
            variant="primary"
            isLoading={isLoading}
            className="h-11 min-h-[44px] px-6 text-sm font-bold shadow-sm"
            iconLeft={<Sparkles className="w-4 h-4" />}
          >
            {initialPlan ? 'Salvar Alterações' : 'Criar Plano no MP'}
          </Button>
        </div>
      }
    >
      <form id="admin-plan-form" onSubmit={handleSubmit} className="space-y-5">
        {errorMsg && (
          <Alert variant="error" onClose={() => setErrorMsg(null)}>
            {errorMsg}
          </Alert>
        )}

        {/* Nome do Plano */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
            Nome / Razão do Plano <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Layers className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex: Plano Pro Anual - Scraping Ilimitado"
              required
              className="w-full pl-10 pr-4 h-11 min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-base sm:text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-colors"
            />
          </div>
        </div>

        {/* Grid de Valor e Frequência */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Valor Mensal em R$ */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
              Valor (R$) <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 font-bold text-sm">
                R$
              </div>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="99.90"
                required
                className="w-full pl-10 pr-4 h-11 min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-base sm:text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-colors"
              />
            </div>
          </div>

          {/* Frequência de Cobrança */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
              Ciclo de Cobrança <span className="text-rose-500">*</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                value={frequency}
                onChange={(e) => setFrequency(parseInt(e.target.value, 10) || 1)}
                required
                className="w-20 h-11 min-h-[44px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-base sm:text-sm text-center focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
              <select
                value={frequencyType}
                onChange={(e) => setFrequencyType(e.target.value as FrequencyType)}
                className="flex-1 h-11 min-h-[44px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-base sm:text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
              >
                <option value="months">Mês / Meses</option>
                <option value="days">Dia / Dias</option>
              </select>
            </div>
          </div>
        </div>

        {/* Grid de Teste Grátis e URL de Retorno */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Dias de Teste Grátis */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
              Dias de Teste Grátis (Free Trial)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Clock className="w-4 h-4" />
              </div>
              <input
                type="number"
                min="0"
                value={freeTrialDays}
                onChange={(e) => setFreeTrialDays(e.target.value)}
                placeholder="0"
                className="w-full pl-10 pr-4 h-11 min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-base sm:text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          {/* URL de Retorno após Pagamento */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
              URL de Retorno (Back URL)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Link className="w-4 h-4" />
              </div>
              <input
                type="url"
                value={backUrl}
                onChange={(e) => setBackUrl(e.target.value)}
                placeholder="https://seuapp.com/checkout/success"
                className="w-full pl-10 pr-4 h-11 min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-base sm:text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>
        </div>
      </form>
    </Modal>
  );
};
