/**
 * src/features/wallet/components/PixRechargeTab.tsx
 *
 * Aba de Pagamento via PIX (Recarga de Créditos da Carteira).
 * Reutiliza o componente atômico PixPaymentDisplay da biblioteca de UI.
 */

import React from 'react';
import { Card } from '@/components/ui/display/Card';
import { PixPaymentDisplay } from '@/components/ui/payment/PixPaymentDisplay';
import { usePixRecharge } from '../hooks/usePixRecharge';
import type { PixRechargeTabProps } from '../types';

export const PixRechargeTab: React.FC<PixRechargeTabProps> = ({
  pixQrCode,
  pixCopiaECola,
  loading,
  onGeneratePix,
}) => {
  // Consome a lógica de tempo/clipboard desacoplada via custom hook da wallet
  const { isCopied, formattedTimeLeft, handleCopyPixCode } = usePixRecharge(pixCopiaECola);

  return (
    <Card
      glass
      className="bg-[#221e2c]/90 border-[#3c3647] rounded-xl p-5 sm:p-6 relative overflow-hidden before:absolute before:top-0 before:left-0 before:right-0 before:h-1 before:bg-gradient-to-r before:from-[#a078ff] before:to-[#6d3bd7] text-[#e7e0ed]"
    >
      <PixPaymentDisplay
        qrCodeBase64={pixQrCode}
        copyPasteCode={pixCopiaECola}
        formattedTimeLeft={formattedTimeLeft}
        isCopied={isCopied}
        loading={loading}
        onCopyPix={handleCopyPixCode}
        onGenerateOrRefreshPix={onGeneratePix}
        copyButtonText="Copiar Chave PIX"
        showPollingIndicator={false}
      />
    </Card>
  );
};

export default PixRechargeTab;
