/**
 * src/features/wallet/components/tabs/CreditCardPaymentTab.tsx
 *
 * Aba de Pagamento Transparente via Cartão de Crédito (Planos SaaS e Recargas).
 * Componente puramente declarativo de UI.
 * Reutiliza o formulário atômico CreditCardPaymentForm e delega a submissão ao hook pai.
 */

import React from 'react';
import { Info } from 'lucide-react';
import { CreditCardPaymentForm, type CreditCardPaymentFormData as CreditCardFormData } from '../payment/CreditCardPaymentForm';

export interface CreditCardPaymentTabProps {
  amountBrl?: number;
  loading: boolean;
  submitButtonText?: string;
  onSubmit: (formData: CreditCardFormData) => Promise<void>;
  className?: string;
}

export const CreditCardPaymentTab: React.FC<CreditCardPaymentTabProps> = ({
  amountBrl = 197.0,
  loading,
  submitButtonText = 'Finalizar Pagamento Seguro',
  onSubmit,
  className,
}) => {
  return (
    <div className="space-y-4">
      {/* Banner Auxiliar para Ambiente de Testes / Sandbox */}
      <div className="rounded-xl bg-indigo-500/10 border border-indigo-500/20 p-3 text-xs text-indigo-300 flex items-start gap-2.5">
        <Info className="w-4 h-4 shrink-0 mt-0.5 text-indigo-400" />
        <div className="space-y-0.5">
          <span className="font-semibold text-indigo-200 block">Ambiente de Testes do Mercado Pago:</span>
          <p className="text-slate-300 text-[11px] leading-relaxed">
            Para aprovação imediata no sandbox, utilize o cartão de teste{' '}
            <code className="px-1 py-0.5 rounded bg-indigo-950/80 border border-indigo-500/30 font-mono text-indigo-200">
              5480 8328 0103 3311
            </code>{' '}
            com CVV <code className="font-mono text-indigo-200">123</code> e validade futura (ex:{' '}
            <code className="font-mono text-indigo-200">12/28</code>).
          </p>
        </div>
      </div>

      <CreditCardPaymentForm
        amountBrl={amountBrl}
        loading={loading}
        submitButtonText={submitButtonText}
        showDocNumber={true}
        onSubmitForm={onSubmit}
        className={className}
      />
    </div>
  );
};

export default CreditCardPaymentTab;
