import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, DollarSign, Zap, CheckCircle2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export interface TopUpCreditModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface CreditOption {
  id: string;
  amountBrl: number;
  estimatedUsd: number;
  label: string;
  badge?: string;
  popular?: boolean;
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

  // Fechar no teclado ESC
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

  const activePack = CREDIT_OPTIONS.find((opt) => opt.id === selectedOption) || CREDIT_OPTIONS[1];

  const handleProceedCheckout = () => {
    onClose();
    // Redireciona para o checkout com as informações do pacote de créditos
    navigate(`/checkout?type=topup&pack=${activePack.id}&amount=${activePack.amountBrl}`);
  };

  return (
    <div
      className="fixed inset-[#0] z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="topup-modal-title"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header do Modal */}
        <div className="p-5 sm:p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-xl">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h2 id="topup-modal-title" className="text-lg font-bold text-slate-900 dark:text-white">
                Recarregar Créditos de IA
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Escolha o pacote ideal para processar seus produtos
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar Modal"
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corpo do Modal - Lista de Pacotes */}
        <div className="p-5 sm:p-6 space-y-3">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
            Selecione o Pacote de Créditos
          </label>

          {CREDIT_OPTIONS.map((option) => {
            const isSelected = option.id === selectedOption;

            return (
              <div
                key={option.id}
                onClick={() => setSelectedOption(option.id)}
                className={`relative flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer transition-all ${
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
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
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

          <div className="flex items-center gap-2 pt-2 text-xs text-slate-500 dark:text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>Pagamento 100% seguro via Mercado Pago (PIX ou Cartão).</span>
          </div>
        </div>

        {/* Footer com Botões */}
        <div className="p-5 sm:p-6 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col sm:flex-row items-center justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            size="md"
            onClick={onClose}
            className="w-full sm:w-auto min-h-[44px]"
          >
            Cancelar
          </Button>

          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={handleProceedCheckout}
            iconLeft={<DollarSign className="w-4 h-4" />}
            className="w-full sm:w-auto min-h-[44px]"
          >
            Ir para Pagamento (R$ {activePack.amountBrl})
          </Button>
        </div>
      </div>
    </div>
  );
};
