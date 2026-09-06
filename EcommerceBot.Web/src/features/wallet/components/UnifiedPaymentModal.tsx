/**
 * src/features/wallet/components/UnifiedPaymentModal.tsx
 *
 * Modal Unificado de Pagamento Transparente do Mercado Pago.
 * Atende tanto Recargas de Créditos quanto Assinaturas de Planos SaaS.
 * Em conformidade estrita com WCAG 2.1 AA e touch targets >= 44px.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  QrCode,
  CreditCard,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Sparkles,
} from 'lucide-react';

import { Modal } from '@/components/ui/overlay/Modal';
import { Button } from '@/components/ui/Button';
import { PixPaymentTab } from './PixPaymentTab';
import { CreditCardPaymentTab } from './CreditCardPaymentTab';
import { walletService } from '../services/wallet.service';
import { useAuth } from '@/features/auth';
import type { CreditCardFormData } from '@/components/ui/payment/CreditCardPaymentForm';
import type {
  PaymentMethod,
  PaymentStatus,
  PixPaymentResponse,
  UnifiedPaymentModalProps,
} from '../types';


export const UnifiedPaymentModal: React.FC<UnifiedPaymentModalProps> = ({

  isOpen,
  target,
  onClose,
  onSuccessPayment,
}) => {
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
    if (pollingRef.current) clearInterval(pollingRef.current);
    onClose();
  }, [onClose]);

  // Limpa polling ao desmontar ou trocar target
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
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
  const handleCopyPix = () => {
    const code = pixData?.qr_code_copy_paste;
    if (code && navigator.clipboard) {
      navigator.clipboard.writeText(code);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 3000);
    }
  };

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
      setError(err instanceof Error ? err.message : 'Erro ao gerar cobrança PIX.');
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
          if (pollingRef.current) clearInterval(pollingRef.current);
          onSuccessPayment?.();
        }
      } catch {
        // Silêncio no polling para evitar ruído
      }
    }, 4000);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [pixData, paymentStatus, onSuccessPayment]);

  // Submissão com Cartão de Crédito
  const handleProcessCreditCard = async (cardData: {
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
      setError(err instanceof Error ? err.message : 'Erro ao processar cartão de crédito.');
    } finally {
      setLoading(false);
    }
  };

  if (!target) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleModalClose}
      title="Checkout Seguro Mercado Pago"
      description={`Finalize a contratação de: ${target.name}`}
      size="lg"
      footer={
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 w-full text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              Total: <strong className="text-white font-mono">R$ {target.amountBrl.toFixed(2)}</strong>
              {target.credits ? ` (${target.credits.toLocaleString('pt-BR')} créditos)` : ''}
            </span>
          </div>

          <Button
            type="button"
            variant="outline"
            size="md"
            onClick={handleModalClose}
            className="w-full sm:w-auto border-slate-700 text-slate-300 min-h-[44px]"
          >
            Fechar
          </Button>
        </div>
      }

    >
      <div className="space-y-6 text-slate-100">
        {/* Banner de Sucesso */}
        {successMessage && (
          <div className="p-4 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-emerald-300 text-sm flex items-center gap-2.5 animate-fade-in">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span className="font-medium">{successMessage}</span>
          </div>
        )}

        {/* Banner de Erro */}
        {error && (
          <div className="p-4 bg-rose-500/20 border border-rose-500/40 rounded-xl text-rose-300 text-sm flex items-center gap-2.5 animate-fade-in">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            <span className="font-medium">{error}</span>
          </div>
        )}

        {/* Resumo do Pedido */}
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span className="font-bold text-white text-sm">{target.name}</span>
            </div>
            <p className="text-xs text-slate-400">
              {target.type === 'plan' ? 'Assinatura com ativação instantânea' : 'Recarga avulsa de créditos'}
            </p>
          </div>
          <div className="text-right">
            <span className="block text-lg font-black text-white font-mono">
              R$ {target.amountBrl.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Seletor de Forma de Pagamento */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setPaymentMethod('pix')}
            className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-bold transition-all min-h-[44px] cursor-pointer ${
              paymentMethod === 'pix'
                ? 'bg-emerald-500/10 border-emerald-500/60 text-emerald-300 shadow-md shadow-emerald-500/10'
                : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            <QrCode className="w-4 h-4 text-emerald-400" />
            <span>PIX (Instantâneo)</span>
          </button>

          <button
            type="button"
            onClick={() => setPaymentMethod('credit_card')}
            className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-bold transition-all min-h-[44px] cursor-pointer ${
              paymentMethod === 'credit_card'
                ? 'bg-indigo-500/10 border-indigo-500/60 text-indigo-300 shadow-md shadow-indigo-500/10'
                : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            <CreditCard className="w-4 h-4 text-indigo-400" />
            <span>Cartão de Crédito</span>
          </button>
        </div>

        {/* Conteúdo Dinâmico da Forma de Pagamento */}
        <div className="pt-2">
          {paymentMethod === 'pix' ? (
            <PixPaymentTab
              pixData={pixData}
              formattedTimeLeft={formattedTimeLeft}
              isCopied={isCopied}
              paymentStatus={paymentStatus}
              loading={loading}
              onCopyPix={handleCopyPix}
              onRefreshPix={handleGeneratePix}
            />
          ) : (
            <CreditCardPaymentTab
              amountBrl={target.amountBrl}
              loading={loading}
              submitButtonText={`Pagar R$ ${target.amountBrl.toFixed(2)}`}
              onSubmit={handleProcessCreditCard}
            />
          )}
        </div>
      </div>
    </Modal>
  );
};

export default UnifiedPaymentModal;
