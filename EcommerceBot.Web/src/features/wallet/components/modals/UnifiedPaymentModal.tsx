/**
 * src/features/wallet/components/modals/UnifiedPaymentModal.tsx
 *
 * Modal Unificado de Pagamento Transparente do Mercado Pago.
 * Atende tanto Recargas de Créditos quanto Assinaturas de Planos SaaS.
 * Em conformidade estrita com WCAG 2.1 AA e touch targets >= 44px.
 */

import React from 'react';
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
import { PixPaymentTab } from '../tabs/PixPaymentTab';
import { CreditCardPaymentTab } from '../tabs/CreditCardPaymentTab';
import { useUnifiedPayment } from '../../hooks/useUnifiedPayment';
import type { UnifiedPaymentModalProps } from '../../types';

export const UnifiedPaymentModal: React.FC<UnifiedPaymentModalProps> = ({
  isOpen,
  target,
  onClose,
  onSuccessPayment,
}) => {
  const {
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
  } = useUnifiedPayment({
    isOpen,
    target,
    onClose,
    onSuccessPayment,
  });

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
