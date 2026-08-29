/**
 * src/features/checkout/components/PixPaymentTab.tsx
 *
 * Aba de Pagamento Transparente via PIX (Checkout de Planos).
 * Reutiliza o componente atômico PixPaymentDisplay da biblioteca de UI.
 */

import React from 'react';
import { PixPaymentDisplay } from '@/components/ui/payment/PixPaymentDisplay';
import type { PixPaymentResponse, PaymentStatus } from '../types';

export interface PixPaymentTabProps {
  pixData: PixPaymentResponse | null;
  formattedTimeLeft: string;
  isCopied: boolean;
  paymentStatus: PaymentStatus;
  loading: boolean;
  onCopyPix: () => void;
  onRefreshPix?: () => void;
  className?: string;
}

export const PixPaymentTab: React.FC<PixPaymentTabProps> = ({
  pixData,
  formattedTimeLeft,
  isCopied,
  paymentStatus,
  loading,
  onCopyPix,
  onRefreshPix,
  className,
}) => {
  const pixCode =
    pixData?.qr_code_copy_paste ||
    '00020126580014br.gov.bcb.pix0136ecom-autobot-mp-pix-key-99182305204000053039865405149.005802BR5916ECOM AUTOBOT SAO PAULO6009SAO PAULO62070503***6304E8A2';
  const qrBase64 = pixData?.qr_code_base64;

  return (
    <PixPaymentDisplay
      qrCodeBase64={qrBase64}
      copyPasteCode={pixCode}
      formattedTimeLeft={formattedTimeLeft}
      isCopied={isCopied}
      paymentStatus={paymentStatus}
      loading={loading}
      onCopyPix={onCopyPix}
      onGenerateOrRefreshPix={onRefreshPix}
      showPollingIndicator={true}
      className={className}
    />
  );
};

export default PixPaymentTab;
