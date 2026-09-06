/**
 * src/features/wallet/components/CreditCardRechargeTab.tsx
 *
 * Aba de Pagamento via Cartão de Crédito (Recarga de Créditos da Carteira).
 * Reutiliza a tokenização PCI-DSS e a interface do CreditCardPaymentTab da feature checkout.
 */

import React from 'react';
import { Card } from '@/components/ui/display/Card';
import { CreditCardPaymentTab } from './CreditCardPaymentTab';
import { useCreditCardRecharge } from '../hooks/useCreditCardRecharge';
import type { CreditCardRechargeTabProps } from '../types';

export const CreditCardRechargeTab: React.FC<CreditCardRechargeTabProps> = ({
  packageId = 'default-package',
  amountBrl = 80,
  loading = false,
  onSuccessPayment,
  onSubmitCard,
  className,
}) => {
  const { isLoading, handleCheckoutSubmit } = useCreditCardRecharge({
    packageId,
    amountBrl,
    onSubmitCard,
    onSuccessPayment,
  });

  return (
    <Card
      glass
      className={`bg-[#15121b] border-[#494454] rounded-xl p-5 sm:p-6 relative overflow-hidden before:absolute before:top-0 before:left-0 before:right-0 before:h-1 before:bg-gradient-to-r before:from-[#a078ff] before:to-[#6d3bd7] text-[#e7e0ed] ${className || ''}`}
    >
      <CreditCardPaymentTab
        amountBrl={amountBrl}
        loading={loading || isLoading}
        onSubmit={handleCheckoutSubmit}
      />
    </Card>
  );
};

export default CreditCardRechargeTab;


