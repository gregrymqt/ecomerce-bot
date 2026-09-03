import React, { useEffect } from 'react';
import { Coins, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type { AiCreditTopupPayload } from '../../types/aiCapacity.types';

interface RegisterTopupModalProps {
  isOpen: boolean;
  onClose: () => void;
  formData: AiCreditTopupPayload;
  onFieldChange: <K extends keyof AiCreditTopupPayload>(
    field: K,
    value: AiCreditTopupPayload[K]
  ) => void;
  onSubmit: (e?: React.FormEvent) => void;
  loading: boolean;
}

export const RegisterTopupModal: React.FC<RegisterTopupModalProps> = ({
  isOpen,
  onClose,
  formData,
  onFieldChange,
  onSubmit,
  loading,
}) => {
  // Fecha com a tecla Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-topup-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-fade-in"
    >
      <div className="rounded-2xl bg-slate-900 border border-slate-800 w-full max-w-md p-6 space-y-5 shadow-2xl">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <h3 id="modal-topup-title" className="text-lg font-bold text-white flex items-center gap-2">
            <Coins className="w-5 h-5 text-indigo-400" />
            Registrar Recarga de IA
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar modal de recarga"
            className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-4 text-xs">
          <div>
            <label htmlFor="topup-provider" className="block text-slate-300 font-bold mb-1">
              Operadora / Provedor
            </label>
            <select
              id="topup-provider"
              value={formData.provider}
              onChange={(e) => onFieldChange('provider', e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-base text-white min-h-[44px] focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none cursor-pointer"
            >
              <option value="DEEPSEEK">DeepSeek</option>
              <option value="GEMINI">Google Gemini</option>
              <option value="OPENROUTER">OpenRouter (Multimodelo)</option>
            </select>
          </div>

          <div>
            <label htmlFor="topup-amount" className="block text-slate-300 font-bold mb-1">
              Valor Pago (USD)
            </label>
            <input
              id="topup-amount"
              type="number"
              step="0.01"
              min="1"
              value={formData.amountPaid}
              onChange={(e) => onFieldChange('amountPaid', parseFloat(e.target.value) || 0)}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-base text-white min-h-[44px] focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
              required
            />
          </div>

          <div>
            <label htmlFor="topup-tokens" className="block text-slate-300 font-bold mb-1">
              Tokens Creditados (Aproximado)
            </label>
            <input
              id="topup-tokens"
              type="number"
              step="100000"
              value={formData.tokensCredited ?? 0}
              onChange={(e) => onFieldChange('tokensCredited', parseInt(e.target.value) || 0)}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-base text-white min-h-[44px] focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
            />
          </div>

          <div>
            <label htmlFor="topup-ref" className="block text-slate-300 font-bold mb-1">
              ID da Transação / Referência
            </label>
            <input
              id="topup-ref"
              type="text"
              placeholder="Ex: ch_3Pxyz ou Invoice #123"
              value={formData.transactionReference ?? ''}
              onChange={(e) => onFieldChange('transactionReference', e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-base text-white min-h-[44px] focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
            />
          </div>

          <div>
            <label htmlFor="topup-notes" className="block text-slate-300 font-bold mb-1">
              Observações
            </label>
            <input
              id="topup-notes"
              type="text"
              placeholder="Ex: Recarga para campanha de scraping"
              value={formData.notes ?? ''}
              onChange={(e) => onFieldChange('notes', e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-base text-white min-h-[44px] focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={onClose}
              className="min-h-[44px] text-xs cursor-pointer"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={loading}
              className="min-h-[44px] bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white shadow-md shadow-indigo-600/20 cursor-pointer"
            >
              Salvar Recarga
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RegisterTopupModal;
