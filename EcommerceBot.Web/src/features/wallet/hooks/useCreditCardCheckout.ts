/**
 * src/features/wallet/hooks/useCreditCardCheckout.ts
 *
 * Hook especializado para o fluxo de checkout com Cartão de Crédito.
 * Encapsula a tokenização segura PCI-DSS (via mercadoPagoService)
 * e o envio ao backend transacional (via walletService).
 */

import { useState, useCallback } from 'react';
import { walletService } from '../services/wallet.service';
import { mercadoPagoService, detectPaymentMethodId } from '../services/mercadoPago.service';
import type { CheckoutTarget, CreditCardPaymentFormData as CreditCardFormData } from '../types';
import type { TenantBillingProfile } from '../types/billing.type';
import { getErrorMessage } from '@/utils/errors';
import { isValidCpfOrCnpjDigits, sanitizeDocumentNumber } from '../utils/documentValidation';

export interface UseCreditCardCheckoutOptions {
  target: CheckoutTarget | null;
  userEmail?: string;
  billingProfile: TenantBillingProfile | null;
  onPaymentApproved: (message: string) => void;
  onPaymentDeclined: (message: string) => void;
  onRequireBillingEdit?: () => void;
  onSuccessPayment?: () => void;
}

export function useCreditCardCheckout({
  target,
  userEmail,
  billingProfile,
  onPaymentApproved,
  onPaymentDeclined,
  onRequireBillingEdit,
  onSuccessPayment,
}: UseCreditCardCheckoutOptions) {
  const [loading, setLoading] = useState<boolean>(false);

  const handleProcessCreditCard = useCallback(
    async (formData: CreditCardFormData) => {
      if (!target) return;

      const rawDoc = formData.docNumber || billingProfile?.document_number;
      if (!isValidCpfOrCnpjDigits(rawDoc)) {
        onPaymentDeclined(
          'Informe um CPF ou CNPJ válido do titular antes de finalizar o pagamento.'
        );
        onRequireBillingEdit?.();
        return;
      }

      setLoading(true);

      const docNum = sanitizeDocumentNumber(rawDoc);
      const docType = (billingProfile?.document_type as 'CPF' | 'CNPJ') || (docNum.length > 11 ? 'CNPJ' : 'CPF');
      const paymentMethodId = detectPaymentMethodId(formData.cardNumber);

      try {
        // 1. Tokenização criptográfica oficial no Mercado Pago (retorna token length >= 32)
        const cardToken = await mercadoPagoService.tokenizeCard(formData);

        // 2. Despacho seguro ao backend transacional via recarga de créditos
        const resp = await walletService.processCreditCardRecharge({
          package_id: target.id,
          amount: target.amountBrl,
          payment_method: 'credit_card',
          card_token: cardToken,
          payment_method_id: paymentMethodId,
          installments: formData.installments || 1,
          payer: {
            first_name: formData.cardholderName.split(' ')[0] || 'Cliente',
            last_name: formData.cardholderName.split(' ').slice(1).join(' ') || 'Lojista',
            email: userEmail || billingProfile?.email || 'cliente@loja.com.br',
            identification_type: docType,
            identification_number: docNum,
            address: billingProfile ? {
              zip_code: billingProfile.zip_code,
              street_name: billingProfile.street_name,
              street_number: billingProfile.street_number,
              neighborhood: billingProfile.neighborhood,
              city: billingProfile.city,
              federal_unit: billingProfile.federal_unit,
              complement: billingProfile.complement || undefined,
            } : undefined,
          },
        });

        if (resp.status === 'approved' || resp.status === 'APPROVED') {
          onPaymentApproved('🎉 Recarga aprovada com sucesso! Seus créditos foram adicionados à carteira.');
          onSuccessPayment?.();
        } else {
          onPaymentDeclined('Transação pendente ou recusada pela operadora de cartão.');
        }
      } catch (err: unknown) {
        onPaymentDeclined(getErrorMessage(err, 'Falha ao processar pagamento com cartão de crédito.'));
      } finally {
        setLoading(false);
      }
    },
    [target, userEmail, billingProfile, onPaymentApproved, onPaymentDeclined, onRequireBillingEdit, onSuccessPayment]
  );

  return {
    cardLoading: loading,
    handleProcessCreditCard,
  };
}

export default useCreditCardCheckout;
