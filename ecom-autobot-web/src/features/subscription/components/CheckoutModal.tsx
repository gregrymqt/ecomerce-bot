import React from 'react';
import {
  CreditCard,
  QrCode,
  Copy,
  Check,
  Timer,
  Lock,
  ShieldCheck,
  Sparkles,
  Shield,
} from 'lucide-react';
import { Modal, Button, Badge, Input, Select } from '@/components/ui';
import type { PlanTier, BillingCycle } from '../types/subscription.type';
import { useCheckoutModal } from '../hooks/useCheckoutModal';
import { cn } from '@/utils/cn';

export interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  plan?: PlanTier | null;
  billingCycle?: BillingCycle;
  onPaymentSuccess?: () => void;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  isOpen,
  onClose,
  plan = {
    id: 'pro',
    name: 'Pro',
    priceMonthly: 149,
    priceYearly: 119,
    credits: 1000,
    features: [],
  },
  billingCycle = 'monthly',
  onPaymentSuccess,
}) => {
  const {
    activeTab,
    setActiveTab,
    isCopied,
    formattedTimer,
    isSubmitting,
    cardNumber,
    cardHolder,
    setCardHolder,
    cardExpiry,
    cardCvv,
    setCardCvv,
    installments,
    setInstallments,
    currentPrice,
    pixCopyPasteCode,
    handleCopyPix,
    handleCardNumberChange,
    handleExpiryChange,
    handleSubmitCard,
  } = useCheckoutModal({
    isOpen,
    onClose,
    plan,
    billingCycle,
    onPaymentSuccess,
  });

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="md"
    >
      <div className="text-white space-y-6">
        {/* Header Badges & Title */}
        <div>
          <Badge variant="purple" icon={<Sparkles className="h-3.5 w-3.5" />}>
            Checkout Transparente Mercado Pago
          </Badge>
          <h3 className="text-2xl font-black tracking-tight text-white mt-2">
            Assinar {plan?.name || 'Plano Pro'}
          </h3>
          <p className="text-xs text-gray-400 mt-1 font-mono">
            Total: <span className="text-white font-extrabold text-sm">R$ {currentPrice},00</span> /mês ({billingCycle === 'yearly' ? 'Cobrança Anual' : 'Cobrança Mensal'})
          </p>
        </div>

        {/* Tab Switcher: PIX vs Cartão */}
        <div className="grid grid-cols-2 gap-2 p-1.5 rounded-2xl bg-gray-950/80 border border-gray-800">
          <button
            type="button"
            onClick={() => setActiveTab('pix')}
            className={cn(
              'h-11 min-h-[44px] rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 cursor-pointer select-none font-mono',
              activeTab === 'pix'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
                : 'text-gray-400 hover:text-white'
            )}
          >
            <QrCode className="h-4 w-4" />
            <span>PIX Instantâneo</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('credit_card')}
            className={cn(
              'h-11 min-h-[44px] rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 cursor-pointer select-none font-mono',
              activeTab === 'credit_card'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
                : 'text-gray-400 hover:text-white'
            )}
          >
            <CreditCard className="h-4 w-4" />
            <span>Cartão de Crédito</span>
          </button>
        </div>

        {/* Tab Content: PIX */}
        {activeTab === 'pix' && (
          <div className="space-y-5 text-center">
            {/* Countdown Timer */}
            <div className="inline-flex items-center gap-2 rounded-xl bg-amber-500/10 px-4 py-2 text-xs font-bold text-amber-400 border border-amber-500/30 font-mono">
              <Timer className="h-4 w-4 animate-pulse text-amber-400" />
              <span>QR Code expira em: {formattedTimer}</span>
            </div>

            {/* Simulated QR Code Canvas */}
            <div className="mx-auto flex h-48 w-48 items-center justify-center rounded-2xl bg-white p-3 shadow-inner border-4 border-purple-500/20">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
                  pixCopyPasteCode
                )}`}
                alt="QR Code PIX Mercado Pago"
                className="h-full w-full object-contain"
              />
            </div>

            {/* Copia e Cola Section */}
            <div className="space-y-2 text-left">
              <label className="text-xs font-semibold text-gray-300 font-mono">Código PIX Copia e Cola:</label>
              <div className="flex gap-2">
                <Input
                  type="text"
                  readOnly
                  value={pixCopyPasteCode}
                  className="font-mono"
                />
                <Button
                  type="button"
                  onClick={handleCopyPix}
                  variant={isCopied ? 'primary' : 'secondary'}
                  iconLeft={isCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                >
                  {isCopied ? 'Copiado!' : 'Copiar'}
                </Button>
              </div>
            </div>

            <p className="text-[11px] text-gray-400 font-mono">
              Aprovação instantânea de créditos assim que o pagamento PIX for compensado no banco.
            </p>
          </div>
        )}

        {/* Tab Content: Credit Card Form */}
        {activeTab === 'credit_card' && (
          <form onSubmit={handleSubmitCard} className="space-y-4 text-left">
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1 font-mono">Número do Cartão</label>
              <Input
                type="text"
                required
                placeholder="0000 0000 0000 0000"
                value={cardNumber}
                onChange={handleCardNumberChange}
                iconRight={<CreditCard className="h-5 w-5 text-gray-500" />}
                className="font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1 font-mono">Nome no Cartão</label>
              <Input
                type="text"
                required
                placeholder="NOME COMO CONSTADO NO CARTÃO"
                value={cardHolder}
                onChange={(e) => setCardHolder(e.target.value.toUpperCase())}
                className="font-mono uppercase"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1 font-mono font-mono">Validade (MM/AA)</label>
                <Input
                  type="text"
                  required
                  placeholder="MM/AA"
                  value={cardExpiry}
                  onChange={handleExpiryChange}
                  className="font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1 font-mono">CVV</label>
                <Input
                  type="password"
                  required
                  maxLength={4}
                  placeholder="123"
                  value={cardCvv}
                  onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, ''))}
                  className="font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1 font-mono">Parcelamento</label>
              <Select
                value={installments}
                onChange={(e) => setInstallments(e.target.value)}
                options={[
                  { value: '1', label: `1x de R$ ${currentPrice},00 à vista sem juros` },
                  { value: '2', label: `2x de R$ ${(currentPrice / 2).toFixed(2)} sem juros` },
                  { value: '3', label: `3x de R$ ${(currentPrice / 3).toFixed(2)} sem juros` },
                  { value: '6', label: `6x de R$ ${(currentPrice / 6).toFixed(2)} sem juros` },
                  { value: '12', label: `12x de R$ ${(currentPrice / 12).toFixed(2)} sem juros` },
                ]}
              />
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              isLoading={isSubmitting}
              variant="primary"
              iconLeft={!isSubmitting ? <Lock className="h-4 w-4" /> : undefined}
              className="w-full mt-2"
            >
              Finalizar Assinatura — R$ {currentPrice},00
            </Button>
          </form>
        )}

        {/* Security Badges Footer */}
        <div className="mt-6 pt-4 border-t border-gray-800 flex flex-wrap items-center justify-center gap-4 text-[10px] font-bold tracking-wider uppercase text-gray-400 font-mono">
          <span className="flex items-center gap-1">
            <Lock className="h-3.5 w-3.5 text-emerald-400" /> SSL 256-BIT ENCRYPTED
          </span>
          <span className="flex items-center gap-1">
            <ShieldCheck className="h-3.5 w-3.5 text-purple-400" /> PCI DSS COMPLIANT
          </span>
          <span className="flex items-center gap-1">
            <Shield className="h-3.5 w-3.5 text-indigo-400" /> MERCADO PAGO SECURE
          </span>
        </div>
      </div>
    </Modal>
  );
};

