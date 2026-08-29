/**
 * src/features/metering/components/TopUpCreditModal.tsx
 *
 * Modal padronizado de seleção de pacotes para recarga de créditos de IA.
 * Em conformidade com acessibilidade WCAG 2.1 AA e touch targets mínimos de 44px.
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DollarSign, CheckCircle2, ShieldCheck } from 'lucide-react';
import { Modal, Button } from '@/components/ui';
import type { CreditOption } from '../types';

export interface TopUpCreditModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CREDIT_OPTIONS: CreditOption[] = [
  {
    id: 'pack_20',
    amountBrl: 20,
    estimatedUsd: 4.0,
    label: 'Pacote Starter',
    badge: '~25.000 produtos enriquecidos',
  },
  {
    id: 'pack_50',
    amountBrl: 50,
    estimatedUsd: 10.0,
    label: 'Pacote Pro',
    badge: '~70.000 produtos enriquecidos',
    popular: true,
  },
  {
    id: 'pack_100',
    amountBrl: 100,
    estimatedUsd: 20.0,
    label: 'Pacote Enterprise',
    badge: '~150.000 produtos enriquecidos',
  },
];

export const TopUpCreditModal: React.FC<TopUpCreditModalProps> = ({
  isOpen,
  onClose,
}) => {
  const navigate = useNavigate();
  const [selectedOption, setSelectedOption] = useState<string>('pack_50');

  if (!isOpen) return null;

  const activePack = CREDIT_OPTIONS.find((opt) => opt.id === selectedOption) || CREDIT_OPTIONS[1];

  const handleProceedCheckout = () => {
    onClose();
    // Redireciona para o checkout com as informações do pacote de créditos
    navigate(`/checkout?type=topup&pack=${activePack.id}&amount=${activePack.amountBrl}`);
  };

  const footerActions = (
    <div className="flex flex-col sm:flex-row items-center justify-end gap-3 w-full">
      <Button
        type="button"
        variant="secondary"
        onClick={onClose}
        className="w-full sm:w-auto min-h-[44px]"
      >
        Cancelar
      </Button>

      <Button
        type="button"
        variant="primary"
        onClick={handleProceedCheckout}
        iconLeft={<DollarSign className="w-4 h-4" />}
        className="w-full sm:w-auto min-h-[44px] bg-indigo-600 hover:bg-indigo-500 font-bold text-white shadow-lg shadow-indigo-600/25"
      >
        Ir para Pagamento (R$ {activePack.amountBrl})
      </Button>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Recarregar Créditos de IA"
      description="Escolha o pacote ideal para processar e enriquecer seus produtos via infraestrutura gerenciada."
      size="md"
      footer={footerActions}
    >
      <div className="space-y-4">
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
          Selecione o Pacote de Créditos
        </label>

        <div
          role="radiogroup"
          aria-label="Pacotes de créditos disponíveis"
          className="space-y-3"
        >
          {CREDIT_OPTIONS.map((option) => {
            const isSelected = option.id === selectedOption;

            return (
              <div
                key={option.id}
                role="radio"
                aria-checked={isSelected}
                tabIndex={0}
                onClick={() => setSelectedOption(option.id)}
                onKeyDown={(e) => {
                  if (e.key === ' ' || e.key === 'Enter') {
                    e.preventDefault();
                    setSelectedOption(option.id);
                  }
                }}
                className={`relative flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer transition-all min-h-[44px] focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none ${
                  isSelected
                    ? 'border-indigo-600 dark:border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30 shadow-xs'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900'
                }`}
              >
                {option.popular && (
                  <span className="absolute -top-2.5 right-4 px-2.5 py-0.5 bg-indigo-600 text-white text-[10px] font-extrabold uppercase tracking-wide rounded-full shadow-xs">
                    Mais Popular
                  </span>
                )}

                <div className="flex items-center gap-3">
                  <div
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors shrink-0 ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-600 text-white'
                        : 'border-slate-300 dark:border-slate-700'
                    }`}
                  >
                    {isSelected && <CheckCircle2 className="w-4 h-4 fill-current" />}
                  </div>

                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                      {option.label}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {option.badge}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-base font-extrabold text-slate-900 dark:text-white">
                    R$ {option.amountBrl}
                  </div>
                  <div className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">
                    ~${option.estimatedUsd.toFixed(2)} USD
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-2 pt-2 text-xs text-slate-400">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Pagamento 100% seguro via Mercado Pago (PIX ou Cartão).</span>
        </div>
      </div>
    </Modal>
  );
};

export default TopUpCreditModal;
