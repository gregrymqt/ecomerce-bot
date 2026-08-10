/**
 * src/features/checkout/components/CreditCardPaymentTab.tsx
 *
 * Aba de Pagamento Transparente via Cartão de Crédito (Checkout de Planos).
 * Reutiliza o componente atômico CreditCardPaymentForm da biblioteca de UI.
 */

import React from 'react';
import { CreditCardPaymentForm, type CreditCardFormData } from '@/components/ui/payment/CreditCardPaymentForm';
import type { CreditCardPaymentPayload } from '@/features/checkout';

export interface CreditCardPaymentTabProps {
  planId: string;
  loading: boolean;
  onSubmit: (payload: CreditCardPaymentPayload) => Promise<void>;
  className?: string;
}

export const CreditCardPaymentTab: React.FC<CreditCardPaymentTabProps> = ({
  planId,
  loading,
  onSubmit,
  className,
}) => {
  const handleFormSubmit = async (formData: CreditCardFormData) => {
    await onSubmit({
      plan_id: planId,
      card_number: formData.cardNumber,
      cardholder_name: formData.cardholderName,
      expiration_month: formData.expirationMonth,
      expiration_year: formData.expirationYear,
      security_code: formData.securityCode,
      installments: formData.installments,
      doc_number: formData.docNumber,
    });
  };

  return (
    <CreditCardPaymentForm
      amountBrl={197.0}
      loading={loading}
      submitButtonText="Finalizar Assinatura Segura"
      showDocNumber={true}
      onSubmitForm={handleFormSubmit}
      className={className}
    />
  );
};

export default CreditCardPaymentTab;
