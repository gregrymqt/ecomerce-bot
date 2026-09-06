/**
 * src/features/wallet/components/CreditCardRechargeTab.tsx
 *
 * Aba de Pagamento via Cartão de Crédito (Recarga de Créditos da Carteira).
 * Reutiliza a tokenização PCI-DSS e a interface do CreditCardPaymentTab da feature checkout.
 */

import React from 'react';
import { Card } from '@/components/ui/display/Card';
import { CreditCardPaymentTab } from './CreditCardPaymentTab';
import { walletService } from '../services/wallet.service';
import { useAuth } from '@/features/auth';
import type { CreditCardRechargeTabProps, CreditCardRechargePayload, CardPaymentPayer } from '../types';
import type { CreditCardFormData } from '@/components/ui/payment/CreditCardPaymentForm';

export const CreditCardRechargeTab: React.FC<CreditCardRechargeTabProps> = ({
  packageId = 'default-package',
  amountBrl = 80,
  loading = false,
  onSuccessPayment,
  onSubmitCard,
  className,
}) => {
  const { user } = useAuth();

  const handleCheckoutSubmit = async ({
    formData,
    cardToken,
    paymentMethodId,
  }: {
    formData: CreditCardFormData;
    cardToken: string;
    paymentMethodId: string;
  }) => {
    const cleanDoc = formData.docNumber.replace(/\D/g, '');
    const docType: 'CPF' | 'CNPJ' = cleanDoc.length > 11 ? 'CNPJ' : 'CPF';

    const payer: CardPaymentPayer = {
      email: user?.email || 'cliente@exemplo.com',
      identification: {
        type: docType,
        number: cleanDoc,
      },
    };


    const rechargePayload: CreditCardRechargePayload = {
      package_id: packageId,
      amount: amountBrl,
      payment_method: 'credit_card',
      card_token: cardToken || '',
      payment_method_id: paymentMethodId || 'visa',
      installments: Number(formData.installments) || 1,
      payer: payer,
    };

    if (onSubmitCard) {
      await onSubmitCard(rechargePayload);
    } else {
      await walletService.processCreditCardRecharge(rechargePayload);
    }

    if (onSuccessPayment) {
      onSuccessPayment();
    }
  };

  return (
    <Card
      glass
      className={`bg-[#15121b] border-[#494454] rounded-xl p-5 sm:p-6 relative overflow-hidden before:absolute before:top-0 before:left-0 before:right-0 before:h-1 before:bg-gradient-to-r before:from-[#a078ff] before:to-[#6d3bd7] text-[#e7e0ed] ${className || ''}`}
    >
      <CreditCardPaymentTab
        amountBrl={amountBrl}
        loading={loading}
        onSubmit={handleCheckoutSubmit}
      />
    </Card>
  );
};

export default CreditCardRechargeTab;

