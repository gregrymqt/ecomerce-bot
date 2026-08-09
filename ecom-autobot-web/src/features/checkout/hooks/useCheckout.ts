/**
 * src/features/checkout/hooks/useCheckout.ts
 *
 * Custom Hook reativo para gerenciamento do fluxo de Checkout Transparente.
 * Controla navegação entre PIX e Cartão de Crédito, polling de status, timer regressivo,
 * cópia do código PIX e processamento das requisições de pagamento.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { checkoutService } from '@/features/checkout';
import type {
  PaymentMethod,
  PaymentStatus,
  PixPaymentResponse,
  CreditCardPaymentPayload,
  CreditCardPaymentResponse,
  OrderStatusSyncResponse,
} from '@/features/checkout';
import { getErrorMessage } from '@/utils/errors';

export function useCheckout(initialPlanId?: string) {
  // 1. Estados Reativos Principais
  const [activeTab, setActiveTab] = useState<PaymentMethod>('PIX');
  const [pixData, setPixData] = useState<PixPaymentResponse | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(900); // 15 minutos (900 segundos)
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('PENDING');

  // Ref para o timer de reset do botão de cópia
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Formata os segundos em uma string MM:SS (ex: 15:00 ou 04:32).
   */
  const formatTimeLeft = useCallback((totalSeconds: number): string => {
    const minutes = Math.floor(Math.max(0, totalSeconds) / 60);
    const seconds = Math.floor(Math.max(0, totalSeconds) % 60);
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(minutes)}:${pad(seconds)}`;
  }, []);

  const formattedTimeLeft = formatTimeLeft(timeLeft);

  // 2. Timer Regressivo do PIX (decremente 1s enquanto timeLeft > 0)
  useEffect(() => {
    if (activeTab !== 'PIX' || paymentStatus !== 'PENDING' || timeLeft <= 0) {
      if (timeLeft <= 0 && paymentStatus === 'PENDING' && pixData) {
        setPaymentStatus('EXPIRED');
      }
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setPaymentStatus('EXPIRED');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [activeTab, paymentStatus, timeLeft, pixData]);

  // 3. Polling automático a cada 4s quando pixData.payment_id existir e status for PENDING
  useEffect(() => {
    const paymentId = pixData?.payment_id;
    if (!paymentId || paymentStatus !== 'PENDING' || activeTab !== 'PIX') {
      return;
    }

    const pollInterval = setInterval(async () => {
      try {
        const syncRes: OrderStatusSyncResponse = await checkoutService.syncOrderStatus(paymentId);

        if (syncRes.is_approved || syncRes.status === 'APPROVED') {
          setPaymentStatus('APPROVED');
          clearInterval(pollInterval);
        } else if (syncRes.status && syncRes.status !== 'PENDING') {
          setPaymentStatus(syncRes.status);
          clearInterval(pollInterval);
        }
      } catch {
        // Falhas temporárias de rede no polling são mantidas em silêncio na UI
      }
    }, 4000);

    return () => clearInterval(pollInterval);
  }, [pixData?.payment_id, paymentStatus, activeTab]);

  // 4. Função para copiar código PIX para o clipboard
  const copyPixToClipboard = useCallback(async (codeOverride?: string) => {
    const codeToCopy = codeOverride || pixData?.qr_code_copy_paste;
    if (!codeToCopy) return;

    try {
      await navigator.clipboard.writeText(codeToCopy);
      setIsCopied(true);

      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }

      copyTimeoutRef.current = setTimeout(() => {
        setIsCopied(false);
      }, 3000);
    } catch {
      setError('Não foi possível copiar o código PIX para a área de transferência.');
    }
  }, [pixData]);

  // Limpeza de timeouts ao desmontar o componente
  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  // 5. Handlers de Ações do Usuário

  /**
   * Gera uma cobrança transparente PIX via checkoutService.
   */
  const handleGeneratePix = useCallback(async (planId: string): Promise<PixPaymentResponse | null> => {
    setLoading(true);
    setError(null);
    try {
      const response = await checkoutService.createPixPayment(planId);
      setPixData(response);
      setPaymentStatus(response.status || 'PENDING');
      setTimeLeft(900); // 15 minutos zerados para novo QR Code
      return response;
    } catch (err: unknown) {
      const message = getErrorMessage(err, 'Erro ao solicitar pagamento via PIX.');
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Processa pagamento transparente com cartão de crédito via checkoutService.
   */
  const handleProcessCreditCard = useCallback(
    async (payload: CreditCardPaymentPayload): Promise<CreditCardPaymentResponse | null> => {
      setLoading(true);
      setError(null);
      try {
        const response = await checkoutService.processCreditCard(payload);
        setPaymentStatus(response.status);
        if (response.status === 'REJECTED') {
          setError(response.message || 'Pagamento recusado pela emissora do cartão.');
        }
        return response;
      } catch (err: unknown) {
        const message = getErrorMessage(err, 'Erro ao processar cartão de crédito.');
        setError(message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  /**
   * Sincroniza manualmente o status do pedido/pagamento.
   */
  const syncStatus = useCallback(async (paymentIdOverride?: string): Promise<OrderStatusSyncResponse | null> => {
    const targetId = paymentIdOverride || pixData?.payment_id;
    if (!targetId) return null;

    setLoading(true);
    try {
      const res = await checkoutService.syncOrderStatus(targetId);
      setPaymentStatus(res.status);
      return res;
    } catch (err: unknown) {
      const message = getErrorMessage(err, 'Erro ao sincronizar pagamento.');
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [pixData?.payment_id]);

  /**
   * Reseta todo o estado do checkout para os valores iniciais.
   */
  const resetCheckout = useCallback(() => {
    setActiveTab('PIX');
    setPixData(null);
    setTimeLeft(900);
    setIsCopied(false);
    setLoading(false);
    setError(null);
    setPaymentStatus('PENDING');
  }, []);

  // Efeito opcional de auto-geração se initialPlanId for fornecido na montagem
  useEffect(() => {
    if (initialPlanId && !pixData && activeTab === 'PIX' && !loading && !error) {
      handleGeneratePix(initialPlanId);
    }
  }, [initialPlanId, pixData, activeTab, loading, error, handleGeneratePix]);

  return {
    // Estados
    activeTab,
    setActiveTab,
    pixData,
    timeLeft,
    formattedTimeLeft,
    isCopied,
    loading,
    error,
    paymentStatus,

    // Modificadores & Handlers
    copyPixToClipboard,
    handleGeneratePix,
    handleProcessCreditCard,
    syncStatus,
    resetCheckout,
    setError,
  };
}
