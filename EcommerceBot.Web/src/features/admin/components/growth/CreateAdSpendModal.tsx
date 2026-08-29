/**
 * src/features/admin/components/growth/CreateAdSpendModal.tsx
 *
 * Modal para lançamento e registro de investimentos em tráfego pago (Meta Ads, Google Ads, TikTok).
 */

import React from 'react';
import { Modal } from '@/components/ui/overlay/Modal';
import { FormField } from '@/components/ui/form/FormField';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/feedback/Alert';
import type { CreateAdSpendPayload } from '../../types/growth.types';

interface CreateAdSpendModalProps {
  isOpen: boolean;
  onClose: () => void;
  formData: CreateAdSpendPayload;
  setFormData: React.Dispatch<React.SetStateAction<CreateAdSpendPayload>>;
  onSubmit: (e: React.FormEvent) => void;
  submitting: boolean;
  error?: string | null;
}

export const CreateAdSpendModal: React.FC<CreateAdSpendModalProps> = ({
  isOpen,
  onClose,
  formData,
  setFormData,
  onSubmit,
  submitting,
  error,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Lançar Investimento em Anúncios"
      description="Cadastre o valor gasto em campanhas (Meta Ads, Google Ads) para cálculo de CAC e ROAS."
      size="md"
    >
      <form onSubmit={onSubmit} className="space-y-4">
        {error && (
          <Alert variant="error" title="Erro ao salvar">
            {error}
          </Alert>
        )}

        <FormField
          label="Nome da Campanha"
          name="campaign_name"
          type="text"
          required
          placeholder="Ex: BlackFriday_Lancamento_Pro"
          value={formData.campaign_name}
          onChange={(e) => setFormData({ ...formData, campaign_name: e.target.value })}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col w-full">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Canal (UTM Source)
            </label>
            <select
              value={formData.utm_source}
              onChange={(e) => setFormData({ ...formData, utm_source: e.target.value })}
              className="w-full h-11 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition-all min-h-[44px]"
            >
              <option value="meta_ads">Meta Ads (FB/IG)</option>
              <option value="google_ads">Google Ads</option>
              <option value="tiktok_ads">TikTok Ads</option>
              <option value="influencer">Influenciador / Parceria</option>
            </select>
          </div>

          <FormField
            label="Valor Investido (R$)"
            name="amount_spent"
            type="number"
            step="0.01"
            min="0"
            required
            placeholder="500.00"
            value={formData.amount_spent_brl || ''}
            onChange={(e) =>
              setFormData({ ...formData, amount_spent_brl: parseFloat(e.target.value) || 0 })
            }
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            label="Data Início"
            name="period_start"
            type="date"
            required
            value={formData.period_start}
            onChange={(e) => setFormData({ ...formData, period_start: e.target.value })}
          />

          <FormField
            label="Data Fim"
            name="period_end"
            type="date"
            required
            value={formData.period_end}
            onChange={(e) => setFormData({ ...formData, period_end: e.target.value })}
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
          <Button
            type="button"
            variant="outline"
            size="md"
            onClick={onClose}
            className="min-h-[44px]"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="md"
            isLoading={submitting}
            className="min-h-[44px] bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
          >
            Salvar Lançamento
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default CreateAdSpendModal;
