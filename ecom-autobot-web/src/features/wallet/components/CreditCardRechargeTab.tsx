/**
 * src/features/wallet/components/CreditCardRechargeTab.tsx
 *
 * Aba de Pagamento via Cartão de Crédito (Recarga de Créditos da Carteira).
 * Reutiliza o componente atômico CreditCardPaymentForm da biblioteca de UI.
 */

import React from 'react';
import { Card } from '@/components/ui/display/Card';
import { CreditCardPaymentForm, type CreditCardFormData } from '@/components/ui/payment/CreditCardPaymentForm';

export type { CreditCardFormData };

export interface CreditCardRechargeTabProps {
  onSubmitCard: (cardData: CreditCardFormData) => Promise<void>;
  loading: boolean;
  amountBrl?: number;
}

export const CreditCardRechargeTab: React.FC<CreditCardRechargeTabProps> = ({
  onSubmitCard,
  loading,
  amountBrl = 80,
}) => {
  return (
    <Card
      glass
      className="bg-[#221e2c]/90 border-[#3c3647] rounded-xl p-5 sm:p-6 relative overflow-hidden before:absolute before:top-0 before:left-0 before:right-0 before:h-1 before:bg-gradient-to-r before:from-[#a078ff] before:to-[#6d3bd7] text-[#e7e0ed]"
    >
      <CreditCardPaymentForm
        amountBrl={amountBrl}
        loading={loading}
        submitButtonText={`Pagar Agora R$ ${amountBrl}`}
        showDocNumber={false}
        onSubmitForm={onSubmitCard}
      />
    </Card>
  );
};

export default CreditCardRechargeTab;
