/**
 * src/features/wallet/hooks/useUnifiedPayment.ts
 *
 * Hook unificado para orquestração de pagamento (PIX e Cartão de Crédito)
 * via Mercado Pago para recarga de créditos e planos SaaS.
 * Encapsula timers, polling de aprovação, clipboard e chamadas ao walletService.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { walletService } from '../services/wallet.service';
import { useAuth } from '@/features/auth';
import type { CreditCardFormData } from '@/components/ui/payment/CreditCardPaymentForm';
import type {
  PaymentMethod,
  PaymentStatus,
  PixPaymentResponse,
  CheckoutTarget,
} from '../types';
import { getErrorMessage } from '@/utils/errors';

export interface UseUnifiedPaymentOptions {
  isOpen: boolean;
  target: CheckoutTarget | null;
  onClose: () => void;
  onSuccessPayment?: () => void;
}

export function useUnifiedPayment({
  isOpen,
  target,
  onClose,
  onSuccessPayment,
}: UseUnifiedPaymentOptions) {
  const { user } = useAuth();
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pix');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('PENDING');

  // Estado PIX
  const [pixData, setPixData] = useState<PixPaymentResponse | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number>(1800);
  const [isCopied, setIsCopied] = useState<boolean>(false);

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleModalClose = useCallback(() => {
    setPixData(null);
    setError(null);
    setSuccessMessage(null);
    setPaymentStatus('PENDING');
    setLoading(false);
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    onClose();
  }, [onClose]);

  // Limpa polling ao desmontar ou trocar target
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [target]);

  // Timer do PIX (30 minutos)
  useEffect(() => {
    if (!pixData || paymentStatus === 'APPROVED') return;

    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setPaymentStatus('EXPIRED');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [pixData, paymentStatus]);

  const formattedTimeLeft = `${Math.floor(secondsLeft / 60)
    .toString()
    .padStart(2, '0')}:${(secondsLeft % 60).toString().padStart(2, '0')}`;

  // Copiar PIX
  const handleCopyPix = useCallback(() => {
    const code = pixData?.qr_code_copy_paste;
    if (code && typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(code);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 3000);
    }
  }, [pixData?.qr_code_copy_paste]);

  // Geração de Cobrança PIX
  const handleGeneratePix = useCallback(async () => {
    if (!target) return;
    setLoading(true);
    setError(null);

    try {
      if (target.type === 'plan') {
        const resp = await walletService.createPixPlanPayment(target.id);
        setPixData(resp);
      } else {
        const resp = await walletService.createRecharge({
          credits_package: target.credits,
          payment_method: 'pix',
          payer_email: user?.email || 'cliente@loja.com.br',
        });
        setPixData({
          payment_id: resp.payment_id,
          qr_code_base64: resp.pix_qr_code || '',
          qr_code_copy_paste: resp.pix_copia_e_cola || '',
          expires_at: resp.expiration_date || new Date().toISOString(),
          status: 'PENDING',
        });
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Erro ao gerar cobrança PIX.'));
    } finally {
      setLoading(false);
    }
  }, [target, user]);

  // Dispara geração de PIX ao abrir modal em aba PIX
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (isOpen && target && paymentMethod === 'pix' && !pixData && !loading) {
      timer = setTimeout(() => {
        void handleGeneratePix();
      }, 0);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isOpen, target, paymentMethod, pixData, loading, handleGeneratePix]);

  // Polling de verificação de aprovação
  useEffect(() => {
    const paymentId = pixData?.payment_id;
    if (!paymentId || paymentStatus === 'APPROVED') return;

    pollingRef.current = setInterval(async () => {
      try {
        const statusResp = await walletService.syncPaymentStatus(paymentId);
        if (statusResp.is_approved || statusResp.status === 'APPROVED') {
          setPaymentStatus('APPROVED');
          setSuccessMessage('🎉 Pagamento aprovado com sucesso! Seus créditos/plano foram ativados.');
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
          onSuccessPayment?.();
        }
      } catch {
        // Silêncio no polling para evitar ruído
      }
    }, 4000);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [pixData?.payment_id, paymentStatus, onSuccessPayment]);

  // Submissão com Cartão de Crédito
  const handleProcessCreditCard = useCallback(
    async (cardData: {
      formData: CreditCardFormData;
      cardToken: string;
      paymentMethodId: string;
    }) => {
      if (!target) return;
      setLoading(true);
      setError(null);

      const expMonth = cardData.formData.expirationMonth;
      const expYear = cardData.formData.expirationYear;

      try {
        if (target.type === 'plan') {
          const resp = await walletService.processCreditCardPlanPayment({
            plan_id: target.id,
            card_number: cardData.formData.cardNumber,
            cardholder_name: cardData.formData.cardholderName,
            expiration_month: expMonth || '12',
            expiration_year: expYear ? (expYear.length === 2 ? `20${expYear}` : expYear) : '2028',
            security_code: cardData.formData.securityCode,
            installments: cardData.formData.installments || 1,
            doc_number: cardData.formData.docNumber || '00000000000',
            card_token: cardData.cardToken,
            payment_method_id: cardData.paymentMethodId,
          });

          if (resp.status === 'APPROVED') {
            setPaymentStatus('APPROVED');
            setSuccessMessage('🎉 Pagamento aprovado! Seu plano foi atualizado com sucesso.');
            onSuccessPayment?.();
          } else {
            setError(resp.message || 'Transação não autorizada pela operadora.');
          }
        } else {
          const resp = await walletService.processCreditCardRecharge({
            package_id: target.id,
            amount: target.amountBrl,
            payment_method: 'credit_card',
            card_token: cardData.cardToken,
            payment_method_id: cardData.paymentMethodId,
            installments: cardData.formData.installments || 1,
            payer: {
              email: user?.email || 'cliente@loja.com.br',
              identification: {
                type: 'CPF',
                number: cardData.formData.docNumber || '00000000000',
              },
            },
          });

          if (resp.status === 'approved' || resp.status === 'APPROVED') {
            setPaymentStatus('APPROVED');
            setSuccessMessage('🎉 Recarga aprovada! Seus créditos foram adicionados à carteira.');
            onSuccessPayment?.();
          } else {
            setError('Transação pendente ou recusada pela operadora de cartão.');
          }
        }
      } catch (err: unknown) {
        setError(getErrorMessage(err, 'Erro ao processar cartão de crédito.'));
      } finally {
        setLoading(false);
      }
    },
    [target, user, onSuccessPayment]
  );

  return {
    paymentMethod,
    setPaymentMethod,
    loading,
    error,
    successMessage,
    paymentStatus,
    pixData,
    formattedTimeLeft,
    isCopied,
    handleCopyPix,
    handleGeneratePix,
    handleProcessCreditCard,
    handleModalClose,
  };
}

export default useUnifiedPayment;
