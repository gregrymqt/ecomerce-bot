import React, { useState } from 'react';
import {
  QrCode,
  CreditCard,
  ShoppingBag,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import type { OrderItem, CustomerInfo } from '../types/checkout.type';
import { useCheckout } from '../hooks/useCheckout';
import { PixModal } from './PixModal';
import { CreditCardForm } from './CreditCardForm';
import { Card } from '@/components/ui/display/Card';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/feedback/Alert';
import { cn } from '@/utils/cn';

export interface CheckoutWidgetProps {
  items: OrderItem[];
  totalAmount: number;
  externalReference: string;
  defaultCustomer?: Partial<CustomerInfo>;
  onSuccess?: (orderId: string) => void;
  className?: string;
}

export type PaymentTab = 'pix' | 'credit_card';

export const CheckoutWidget: React.FC<CheckoutWidgetProps> = ({
  items,
  totalAmount,
  externalReference,
  defaultCustomer,
  onSuccess,
  className,
}) => {
  const [activeTab, setActiveTab] = useState<PaymentTab>('pix');
  const [isPixModalOpen, setIsPixModalOpen] = useState(false);
  const [isOrderCompleted, setIsOrderCompleted] = useState(false);

  const {
    loading,
    error,
    checkoutResult,
    processPixPayment,
    processCreditCardPayment,
    syncOrder,
  } = useCheckout();

  // Tratamento da Geração de Cobrança PIX
  const handleGeneratePix = async () => {
    try {
      const customerPayload: CustomerInfo = {
        email: defaultCustomer?.email || 'cliente@tenant.com',
        first_name: defaultCustomer?.first_name || 'Cliente',
        last_name: defaultCustomer?.last_name || 'Tenant',
        document_type: defaultCustomer?.document_type || 'CPF',
        document_number: defaultCustomer?.document_number || '00000000000',
      };

      const result = await processPixPayment({
        external_reference: externalReference,
        total_amount: totalAmount,
        customer: customerPayload,
        items,
      });

      if (result) {
        setIsPixModalOpen(true);
      }
    } catch (err) {
      console.error('[CheckoutWidget] Erro ao gerar PIX:', err);
    }
  };

  // Sucesso na verificação do PIX ou Cartão
  const handlePaymentSuccess = () => {
    setIsOrderCompleted(true);
    if (onSuccess && checkoutResult?.order_id) {
      onSuccess(checkoutResult.order_id);
    }
  };

  return (
    <div className={cn('max-w-4xl mx-auto space-y-6', className)}>
      {/* Resumo do Pedido / Carrinho */}
      <Card glass className="p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-md">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                Resumo da Compra
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                Checkout Transparente
              </h2>
            </div>
          </div>

          <div className="text-left sm:text-right">
            <span className="text-xs text-slate-500 dark:text-slate-400 block">Total a Pagar</span>
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
              R$ {totalAmount.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Lista de Itens do Pedido */}
        <div className="py-4 space-y-2">
          {items.map((item, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between text-sm py-1.5 border-b border-slate-50 dark:border-slate-800/50 last:border-0"
            >
              <div className="flex items-center gap-2">
                <span className="font-bold text-indigo-600 dark:text-indigo-400">
                  {item.quantity}x
                </span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {item.title}
                </span>
              </div>
              <span className="font-mono text-slate-600 dark:text-slate-400">
                R$ {(Number(item.unit_price) * item.quantity).toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      </Card>

      {/* Exibição de Alerta de Erro se houver */}
      {error && (
        <Alert variant="error" title="Erro no Processamento">
          {error}
        </Alert>
      )}

      {/* Tela de Pedido Concluído com Sucesso */}
      {isOrderCompleted ? (
        <Card className="p-8 text-center space-y-4 border-2 border-emerald-500/50 bg-emerald-50/50 dark:bg-emerald-950/20">
          <div className="w-16 h-16 rounded-full bg-emerald-600 text-white flex items-center justify-center mx-auto shadow-lg">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <h3 className="text-2xl font-black text-slate-900 dark:text-white">
            Pagamento Realizado com Sucesso!
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-300 max-w-md mx-auto">
            Obrigado! Seu pagamento referente ao pedido{' '}
            <strong className="font-mono">{checkoutResult?.order_id || externalReference}</strong>{' '}
            foi confirmado. Os recursos já foram ativados para o seu tenant.
          </p>
        </Card>
      ) : (
        /* Seletor de Abas de Pagamento e Conteúdo */
        <Card className="p-6 sm:p-8 space-y-6 border border-slate-200 dark:border-slate-800 shadow-sm">
          {/* Abas de Navegação (PIX / Cartão de Crédito) */}
          <div className="grid grid-cols-2 gap-2 p-1.5 bg-slate-100 dark:bg-slate-800/70 rounded-2xl border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setActiveTab('pix')}
              className={cn(
                'flex items-center justify-center gap-2 h-11 min-h-[44px] rounded-xl text-sm font-bold transition-all duration-200 cursor-pointer',
                activeTab === 'pix'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              )}
            >
              <QrCode className="w-4 h-4" /> Pagamento via PIX
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('credit_card')}
              className={cn(
                'flex items-center justify-center gap-2 h-11 min-h-[44px] rounded-xl text-sm font-bold transition-all duration-200 cursor-pointer',
                activeTab === 'credit_card'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              )}
            >
              <CreditCard className="w-4 h-4" /> Cartão de Crédito
            </button>
          </div>

          {/* Conteúdo da Aba PIX */}
          {activeTab === 'pix' && (
            <div className="space-y-6 text-center py-4">
              <div className="p-6 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 space-y-2">
                <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                  <Sparkles className="w-4 h-4" /> Aprovação Instantânea 24/7
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Pague com PIX e libere seu acesso imediatamente
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 max-w-lg mx-auto leading-relaxed">
                  Ao clicar no botão abaixo, um QR Code exclusivo e o código Copia e Cola serão gerados via Mercado Pago para você realizar a transferência pelo app do seu banco.
                </p>
              </div>

              <Button
                type="button"
                variant="primary"
                size="lg"
                isLoading={loading}
                onClick={handleGeneratePix}
                className="w-full h-12 min-h-[44px] text-base font-bold shadow-md bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white"
                iconLeft={<QrCode className="w-5 h-5" />}
              >
                Gerar QR Code PIX - R$ {totalAmount.toFixed(2)}
              </Button>

              <div className="flex items-center justify-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <span>Garantia de segurança Mercado Pago Preapproval</span>
              </div>
            </div>
          )}

          {/* Conteúdo da Aba Cartão de Crédito */}
          {activeTab === 'credit_card' && (
            <CreditCardForm
              totalAmount={totalAmount}
              items={items}
              externalReference={externalReference}
              defaultCustomer={defaultCustomer}
              onSubmitPayment={async (payload) => {
                const res = await processCreditCardPayment(payload);
                if (res && (res.status === 'approved' || res.status === 'processed')) {
                  handlePaymentSuccess();
                }
              }}
              isLoading={loading}
            />
          )}
        </Card>
      )}

      {/* Modal PIX com QR Code e Polling de Status */}
      <PixModal
        isOpen={isPixModalOpen}
        onClose={() => setIsPixModalOpen(false)}
        checkoutResult={checkoutResult}
        onSyncOrder={syncOrder}
        onPaymentSuccess={handlePaymentSuccess}
      />
    </div>
  );
};
