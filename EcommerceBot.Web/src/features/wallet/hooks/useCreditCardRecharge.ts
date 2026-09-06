/**
 * src/features/wallet/hooks/useCreditCardRecharge.ts
 *
 * Hook especializado para recarga de carteira via cartão de crédito.
 * Encapsula a formatação de dados do pagador, montagem do payload e chamada à API.
 */

import { useState, useCallback } from 'react';
import { walletService } from '../services/wallet.service';
import { useAuth } from '@/features/auth';
import type { CreditCardRechargePayload, CardPaymentPayer } from '../types';
import type { CreditCardFormData } from '@/components/ui/payment/CreditCardPaymentForm';
import { getErrorMessage } from '@/utils/errors';

export interface UseCreditCardRechargeOptions {
  packageId?: string;
  amountBrl?: number;
  onSubmitCard?: (payload: CreditCardRechargePayload) => Promise<void>;
  onSuccessPayment?: () => void;
}

export function useCreditCardRecharge(options: UseCreditCardRechargeOptions = {}) {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleCheckoutSubmit = useCallback(
    async ({
      formData,
      cardToken,
      paymentMethodId,
    }: {
      formData: CreditCardFormData;
      cardToken: string;
      paymentMethodId: string;
    }) => {
      setIsLoading(true);
      setError(null);

      try {
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
          package_id: options.packageId || 'default-package',
          amount: options.amountBrl || 80,
          payment_method: 'credit_card',
          card_token: cardToken || '',
          payment_method_id: paymentMethodId || 'visa',
          installments: Number(formData.installments) || 1,
          payer,
        };

        if (options.onSubmitCard) {
          await options.onSubmitCard(rechargePayload);
        } else {
          await walletService.processCreditCardRecharge(rechargePayload);
        }

        if (options.onSuccessPayment) {
          options.onSuccessPayment();
        }
      } catch (err: unknown) {
        const message = getErrorMessage(err, 'Falha ao processar pagamento com cartão de crédito.');
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [options, user]
  );

  return {
    isLoading,
    error,
    handleCheckoutSubmit,
  };
}

export default useCreditCardRecharge;
