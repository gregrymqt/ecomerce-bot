/**
 * src/features/plans/components/AdminPlanModal.tsx
 *
 * Modal padronizado para criação e edição de pacotes de créditos/quotas de IA.
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
  const [price, setPrice] = useState<number | ''>(() => editingPlan?.price ?? 149);
  const [creditsIncluded, setCreditsIncluded] = useState<number | ''>(() => editingPlan?.creditsIncluded ?? 2000);
  const [badge, setBadge] = useState(() => editingPlan?.badge || '');
  const [isActive, setIsActive] = useState(() => editingPlan?.isActive ?? (editingPlan ? editingPlan.status === 'active' : true));
  const [formError, setFormError] = useState<string | null>(null);

  const isEditMode = Boolean(editingPlan);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!name.trim()) {
      setFormError('Por favor informe o nome do pacote.');
      return;
    }

    if (typeof price !== 'number' || price < 0) {
      setFormError('Informe um valor de preço válido maior ou igual a zero.');
      return;
    }

    if (typeof creditsIncluded !== 'number' || creditsIncluded <= 0) {
      setFormError('Informe uma quantidade de créditos válida maior que zero.');
      return;
    }

    try {
      if (isEditMode) {
        const payload: UpdatePlanRequest = {
          name: name.trim(),
          description: description.trim() || undefined,
          price: price as number,
          creditsIncluded: creditsIncluded as number,
          badge: badge.trim() || undefined,
          isActive,
        };
        await onSave(payload);
      } else {
        const payload: CreatePlanRequest = {
          name: name.trim(),
          description: description.trim() || undefined,
          price: price as number,
          creditsIncluded: creditsIncluded as number,
          badge: badge.trim() || undefined,
          isActive,
        };
        await onSave(payload);
      }
    } catch (err: unknown) {
      setFormError(getErrorMessage(err, 'Erro ao processar a requisição do pacote de recarga.'));
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
        className="w-full sm:w-auto min-h-[44px] bg-indigo-600 hover:bg-indigo-500 font-bold text-white shadow-lg shadow-indigo-600/25 cursor-pointer"
      >
        {isEditMode ? 'Atualizar Pacote' : 'Criar Novo Pacote'}
      </Button>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditMode ? 'Editar Pacote de Recarga' : 'Criar Novo Pacote de Recarga'}
      description={
        isEditMode
          ? `Atualizando pacote de quotas ID: ${editingPlan?.id}`
          : 'Cadastre um novo pacote de recarga de créditos de IA para os lojistas.'
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
          <label htmlFor="package-name-input" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider font-mono mb-1.5">
            Nome do Pacote *
          </label>
          <Input
            id="package-name-input"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Pro AI (2.000 Créditos)"
            disabled={submitting}
            className="text-base min-h-[44px]"
            required
          />
        </div>

        <div>
          <label htmlFor="package-desc-input" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider font-mono mb-1.5">
            Descrição do Pacote
          </label>
          <Input
            id="package-desc-input"
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
            <label htmlFor="package-price-input" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider font-mono mb-1.5">
              Valor da Recarga (R$) *
            </label>
            <Input
              id="package-price-input"
              type="number"
              step="0.01"
              min="0"
              value={price}
              onChange={(e) => setPrice(e.target.value ? parseFloat(e.target.value) : '')}
              placeholder="149.00"
              disabled={submitting}
              className="text-base min-h-[44px] font-mono"
              required
            />
          </div>

          <div>
            <label htmlFor="package-credits-input" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider font-mono mb-1.5">
              Créditos de IA Inclusos *
            </label>
            <Input
              id="package-credits-input"
              type="number"
              min="1"
              value={creditsIncluded}
              onChange={(e) => setCreditsIncluded(e.target.value ? parseInt(e.target.value) : '')}
              placeholder="2000"
              disabled={submitting}
              className="text-base min-h-[44px] font-mono"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="package-badge-input" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider font-mono mb-1.5">
              Badge Promocional / Destaque
            </label>
            <Input
              id="package-badge-input"
              type="text"
              value={badge}
              onChange={(e) => setBadge(e.target.value)}
              placeholder="Ex: Mais Escolhido, Melhor Custo, Popular"
              disabled={submitting}
              className="text-base min-h-[44px]"
            />
          </div>

          <div>
            <label htmlFor="package-status-select" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider font-mono mb-1.5">
              Status do Pacote
            </label>
            <select
              id="package-status-select"
              value={isActive ? 'active' : 'inactive'}
              onChange={(e) => setIsActive(e.target.value === 'active')}
              disabled={submitting}
              className="w-full min-h-[44px] px-3 bg-slate-900 border border-slate-800 rounded-xl text-slate-100 text-base outline-none focus:border-indigo-500 font-mono"
            >
              <option value="active">Ativo (Disponível na vitrine)</option>
              <option value="inactive">Inativo (Oculto da vitrine)</option>
            </select>
          </div>
        </div>
      </form>
    </Modal>
  );
};

export default AdminPlanModal;
