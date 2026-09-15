/**
 * src/features/wallet/hooks/useUnifiedPayment.ts
 *
 * Hook unificado para orquestração de pagamento (PIX e Cartão de Crédito)
 * via Mercado Pago para recarga de créditos e planos SaaS.
 * Encapsula timers, polling de aprovação, clipboard e chamadas ao walletService.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { walletService } from '../services/wallet.service';
import { useBillingProfile } from './useBillingProfile';
import { useCreditCardCheckout } from './useCreditCardCheckout';
import { useAuth } from '@/features/auth';
import { SSEClient } from '@/lib/sseClient';
import type {
  PaymentMethod,
  PaymentStatus,
  PixPaymentData,
  CheckoutTarget,
} from '../types';
import type {
  TenantBillingProfile,
  UpsertTenantBillingProfilePayload,
} from '../types/billing.type';
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

  // Integração com Perfil de Faturamento
  const {
    profile: billingProfile,
    hasProfile: hasBillingProfile,
    loading: billingLoading,
    saving: billingSaving,
    cepLoading,
    saveProfile,
    lookupCep,
  } = useBillingProfile(isOpen);

  const [userEditingOverride, setUserEditingOverride] = useState<boolean | null>(null);

  const isEditingBilling = userEditingOverride ?? (!billingLoading && !hasBillingProfile);

  const setIsEditingBilling = useCallback((editing: boolean) => {
    setUserEditingOverride(editing);
  }, []);

  // Estado PIX
  const [pixData, setPixData] = useState<PixPaymentData | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number>(1800);
  const [isCopied, setIsCopied] = useState<boolean>(false);

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoPixAttemptedRef = useRef<boolean>(false);

  const handleModalClose = useCallback(() => {
    setPixData(null);
    setError(null);
    setSuccessMessage(null);
    setPaymentStatus('PENDING');
    setLoading(false);
    setUserEditingOverride(null);
    autoPixAttemptedRef.current = false;
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    onClose();
  }, [onClose]);

  // Limpa polling ao desmontar ou trocar target/fechar
  useEffect(() => {
    if (!isOpen) {
      autoPixAttemptedRef.current = false;
    }
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [target, isOpen]);

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
    const code = pixData?.pix_qr_code;
    if (code && typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(code);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 3000);
    }
  }, [pixData?.pix_qr_code]);

  // Geração de Cobrança PIX unificada para recarga de créditos
  const handleGeneratePix = useCallback(async (customProfile?: TenantBillingProfile) => {
    if (!target) return;
    const activeProf = customProfile || billingProfile;
    setLoading(true);
    setError(null);

    const docType = activeProf?.document_type || 'CPF';
    const docNum = activeProf?.document_number || '00000000000';

    try {
      const resp = await walletService.createRecharge({
        amount: target.amountBrl,
        package_id: target.id,
        payment_method: 'pix',
        payer: {
          first_name: user?.name?.split(' ')[0] || 'Cliente',
          last_name: user?.name?.split(' ').slice(1).join(' ') || 'Lojista',
          email: user?.email || activeProf?.email || 'cliente@loja.com.br',
          identification_type: docType,
          identification_number: docNum,
          address: activeProf ? {
            zip_code: activeProf.zip_code,
            street_name: activeProf.street_name,
            street_number: activeProf.street_number,
            neighborhood: activeProf.neighborhood,
            city: activeProf.city,
            federal_unit: activeProf.federal_unit,
            complement: activeProf.complement || undefined,
          } : undefined,
        },
      });

      setPixData({
        order_id: resp.order_id,
        payment_id: resp.payment_id,
        pix_qr_code: resp.pix_qr_code || '',
        pix_qr_code_base64: resp.pix_qr_code_base64 || undefined,
        expires_at: resp.expiration_date || new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        status: 'PENDING',
      });
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Erro ao gerar cobrança PIX.'));
    } finally {
      setLoading(false);
    }
  }, [target, user, billingProfile]);

  const handleSaveBilling = useCallback(
    async (payload: UpsertTenantBillingProfilePayload) => {
      try {
        setError(null);
        const saved = await saveProfile(payload);
        setIsEditingBilling(false);
        if (paymentMethod === 'pix' && !pixData) {
          autoPixAttemptedRef.current = true;
          void handleGeneratePix(saved);
        }
      } catch (err: unknown) {
        setError(getErrorMessage(err, 'Erro ao salvar dados de faturamento.'));
      }
    },
    [saveProfile, setIsEditingBilling, paymentMethod, pixData, handleGeneratePix]
  );

  // Dispara geração de PIX ao abrir modal em aba PIX se já tiver perfil salvo (uma única vez)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const canAuto = isOpen && target && paymentMethod === 'pix' && !pixData && !loading && !error && hasBillingProfile && !isEditingBilling && !autoPixAttemptedRef.current;
    if (canAuto) {
      autoPixAttemptedRef.current = true;
      timer = setTimeout(() => void handleGeneratePix(), 0);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isOpen, target, paymentMethod, pixData, loading, error, hasBillingProfile, isEditingBilling, handleGeneratePix]);

  // 1. Detecção reativa em tempo real via Server-Sent Events (SSE)
  useEffect(() => {
    const orderId = pixData?.order_id;
    if (!orderId || paymentStatus === 'APPROVED' || !isOpen) return;

    const sse = new SSEClient<Record<string, unknown>>();
    sse.connect({
      endpoint: '/api/v1/demo/stream',
      onMessage: (data) => {
        if (!data || typeof data !== 'object') return;
        const matchesOrder =
          String(data.order_id) === String(orderId) || String(data.orderId) === String(orderId);

        if (data.type === 'payment_approved' && matchesOrder) {
          setPaymentStatus('APPROVED');
          setSuccessMessage('🎉 Pagamento aprovado com sucesso! Seus créditos foram ativados.');
          window.dispatchEvent(new CustomEvent('wallet:balance-updated'));
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
          onSuccessPayment?.();
        } else if (data.type === 'payment_rejected' && matchesOrder) {
          setPaymentStatus('REJECTED');
          const reason = typeof data.reason === 'string' ? data.reason : 'Pagamento não autorizado pela instituição bancária.';
          setError(`Pagamento recusado: ${reason}`);
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
        }
      },
    });

    return () => {
      sse.close();
    };
  }, [pixData?.order_id, paymentStatus, isOpen, onSuccessPayment]);

  // 2. Polling suave de contingência via GET /api/v1/wallet/recharge/{orderId}
  useEffect(() => {
    const orderId = pixData?.order_id;
    if (!orderId || paymentStatus === 'APPROVED' || paymentStatus === 'REJECTED' || !isOpen) return;

    pollingRef.current = setInterval(async () => {
      try {
        const recharge = await walletService.getRechargeStatus(orderId);
        if (
          recharge &&
          (recharge.status === 'approved' ||
            recharge.status === 'APPROVED' ||
            recharge.status === 'paid' ||
            recharge.status === 'PAID')
        ) {
          setPaymentStatus('APPROVED');
          setSuccessMessage('🎉 Pagamento aprovado com sucesso! Seus créditos foram ativados.');
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
          window.dispatchEvent(new CustomEvent('wallet:balance-updated'));
          onSuccessPayment?.();
        } else if (recharge && (recharge.status === 'rejected' || recharge.status === 'REJECTED')) {
          setPaymentStatus('REJECTED');
          setError('Pagamento não autorizado pela instituição bancária.');
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
        }
      } catch {
        // Silêncio no polling defensivo
      }
    }, 5000);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [pixData?.order_id, paymentStatus, isOpen, onSuccessPayment]);

  // Orquestração especializada de Cartão de Crédito
  const { cardLoading, handleProcessCreditCard } = useCreditCardCheckout({
    target,
    userEmail: user?.email,
    billingProfile,
    onPaymentApproved: (msg) => {
      setPaymentStatus('APPROVED');
      setSuccessMessage(msg);
      setError(null);
    },
    onPaymentDeclined: (msg) => {
      setError(msg);
    },
    onSuccessPayment,
  });

  return {
    paymentMethod,
    setPaymentMethod,
    loading: loading || billingLoading || cardLoading,
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
    // Faturamento e Identificação
    billingProfile,
    hasBillingProfile,
    isEditingBilling,
    setIsEditingBilling,
    billingLoading,
    billingSaving,
    cepLoading,
    handleSaveBilling,
    handleLookupCep: lookupCep,
  };
}

export default useUnifiedPayment;
