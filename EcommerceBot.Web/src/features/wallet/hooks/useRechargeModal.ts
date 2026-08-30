/**
 * src/features/wallet/hooks/useRechargeModal.ts
 *
 * Hook customizado para gerenciar a lógica de estado, chamadas aos serviços HTTP
 * e polling de aprovação de pagamentos do modal de recargas (RechargeModal).
 * Separa integralmente as regras de negócio e chamadas de serviço da camada visual (UI Pura).
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { RechargePackage, RechargeResponse, UseRechargeModalProps } from '../types';
import { walletService } from '../services/wallet.service';
import { checkoutService } from '@/features/checkout/services/checkout.service';
import { useAuth } from '@/features/auth';
import { getErrorMessage } from '@/utils/errors';

export const RECHARGE_PACKAGES: RechargePackage[] = [
  { id: 'pkg_100', credits: 100, price_brl: 20 },
  { id: 'pkg_500', credits: 500, price_brl: 80, discount_badge: '20% OFF', is_popular: true },
  { id: 'pkg_1000', credits: 1000, price_brl: 150 },
];

export function useRechargeModal({
  isOpen,
  onClose,
  onSuccessPayment,
}: UseRechargeModalProps) {
  const { user } = useAuth();
  const [selectedPackage, setSelectedPackage] = useState<string>('pkg_500');
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'credit_card'>('pix');

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [rechargeData, setRechargeData] = useState<RechargeResponse | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<string>('PENDING');

  const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activePackage =
    RECHARGE_PACKAGES.find((pkg) => pkg.id === selectedPackage) || RECHARGE_PACKAGES[1];

  // Reseta estados locais ao abrir/fechar o modal
  useEffect(() => {
    if (!isOpen) {
      setLoading(false);
      setError(null);
      setSuccessMessage(null);
      setRechargeData(null);
      setPaymentStatus('PENDING');
    }
  }, [isOpen]);

  // Limpeza de timeouts ao desmontar
  useEffect(() => {
    return () => {
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current);
      }
    };
  }, []);

  /**
   * Trata a aprovação do pagamento, exibindo mensagem e fechando o modal após delay
   */
  const handlePaymentApproved = useCallback(() => {
    setPaymentStatus('APPROVED');
    setSuccessMessage('Pagamento Aprovado! Seus créditos foram adicionados à carteira.');

    if (successTimeoutRef.current) {
      clearTimeout(successTimeoutRef.current);
    }

    successTimeoutRef.current = setTimeout(() => {
      onSuccessPayment?.();
      onClose();
    }, 1500);
  }, [onSuccessPayment, onClose]);

  /**
   * Polling automático a cada 4 segundos para verificar aprovação no gateway
   */
  useEffect(() => {
    const paymentId = rechargeData?.payment_id;
    if (!paymentId || paymentStatus === 'APPROVED' || !isOpen) {
      return;
    }

    const pollInterval = setInterval(async () => {
      try {
        const syncRes = await checkoutService.syncOrderStatus(paymentId);
        if (syncRes.is_approved || syncRes.status === 'APPROVED') {
          clearInterval(pollInterval);
          handlePaymentApproved();
        } else if (syncRes.status && syncRes.status !== 'PENDING') {
          setPaymentStatus(syncRes.status);
          if (syncRes.status === 'REJECTED') {
            setError('Pagamento recusado pela operadora.');
            clearInterval(pollInterval);
          }
        }
      } catch {
        // Ignora falhas temporárias de rede no polling
      }
    }, 4000);

    return () => clearInterval(pollInterval);
  }, [rechargeData?.payment_id, paymentStatus, isOpen, handlePaymentApproved]);

  /**
   * Dispara a requisição de recarga para o backend via walletService
   */
  const handleCreateRecharge = useCallback(
    async (overrideMethod?: 'pix' | 'credit_card', cardToken?: string) => {
      setLoading(true);
      setError(null);

      const targetMethod = overrideMethod || paymentMethod;
      const payerEmail = user?.email || 'cliente@loja.com.br';

      try {
        const response = await walletService.createRecharge({
          credits_package: activePackage.credits,
          payment_method: targetMethod,
          card_token: cardToken,
          payer_email: payerEmail,
        });

        setRechargeData(response);
        setPaymentStatus(response.status || 'PENDING');

        if (response.status === 'APPROVED') {
          handlePaymentApproved();
        }
      } catch (err: unknown) {
        const msg = getErrorMessage(err, 'Erro ao solicitar recarga de créditos. Tente novamente.');
        setError(msg);
      } finally {
        setLoading(false);
      }
    },
    [paymentMethod, user?.email, activePackage.credits, handlePaymentApproved]
  );

  return {
    selectedPackage,
    setSelectedPackage,
    paymentMethod,
    setPaymentMethod,
    loading,
    error,
    successMessage,
    rechargeData,
    paymentStatus,
    activePackage,
    packages: RECHARGE_PACKAGES,
    handleCreateRecharge,
  };
}

export default useRechargeModal;
