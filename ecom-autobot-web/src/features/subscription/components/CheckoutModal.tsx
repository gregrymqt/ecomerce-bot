import React, { useState, useEffect } from 'react';
import {
  X,
  CreditCard,
  QrCode,
  Copy,
  Check,
  Timer,
  Lock,
  ShieldCheck,
  Sparkles,
  Shield,
  Loader2,
} from 'lucide-react';
import type { PlanTier, BillingCycle, PaymentMethodType } from '../types/subscription.type';
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
  const [activeTab, setActiveTab] = useState<PaymentMethodType>('pix');
  const [isCopied, setIsCopied] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(899); // 14:59
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Card Form State
  const [cardNumber, setCardNumber] = useState('');
  const [cardHolder, setCardHolder] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [installments, setInstallments] = useState('1');

  // ESC key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Timer countdown for PIX
  useEffect(() => {
    if (!isOpen || activeTab !== 'pix') return;
    const interval = setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [isOpen, activeTab]);

  if (!isOpen) return null;

  const currentPrice = plan
    ? billingCycle === 'yearly'
      ? plan.priceYearly
      : plan.priceMonthly
    : 149;

  const formatTimer = (totalSec: number) => {
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const pixCopyPasteCode =
    '00020126580014br.gov.bcb.pix0136ecom-autobot-mp-pix-key-99182305204000053039865405149.005802BR5916ECOM AUTOBOT SAO PAULO6009SAO PAULO62070503***6304E8A2';

  const handleCopyPix = () => {
    navigator.clipboard.writeText(pixCopyPasteCode);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 3000);
  };

  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 16);
    const formatted = value.replace(/(\d{4})/g, '$1 ').trim();
    setCardNumber(formatted);
  };

  const handleExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 4);
    if (value.length >= 3) {
      setCardExpiry(`${value.slice(0, 2)}/${value.slice(2)}`);
    } else {
      setCardExpiry(value);
    }
  };

  const handleSubmitCard = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      if (onPaymentSuccess) onPaymentSuccess();
      onClose();
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Card Container */}
      <div className="relative w-full max-w-lg rounded-2xl border border-gray-800 bg-[#111827] p-6 sm:p-8 shadow-2xl z-10 my-auto text-white">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 h-11 w-11 min-h-[44px] min-w-[44px] rounded-xl bg-gray-800/80 text-gray-400 hover:text-white hover:bg-gray-700 transition-colors flex items-center justify-center cursor-pointer"
          aria-label="Fechar checkout"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Modal Header */}
        <div className="mb-6">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-purple-500/10 px-3 py-1 text-xs font-bold text-[#8B5CF6] border border-purple-500/30 mb-2">
            <Sparkles className="h-3.5 w-3.5" /> Checkout Transparente Mercado Pago
          </div>
          <h3 className="text-2xl font-black tracking-tight text-white">
            Assinar {plan?.name || 'Plano Pro'}
          </h3>
          <p className="text-xs text-gray-400 mt-1">
            Total: <span className="text-white font-extrabold text-sm">R$ {currentPrice},00</span> /mês ({billingCycle === 'yearly' ? 'Cobrança Anual' : 'Cobrança Mensal'})
          </p>
        </div>

        {/* Tab Switcher: PIX vs Cartão */}
        <div className="grid grid-cols-2 gap-2 p-1.5 rounded-2xl bg-gray-950/80 border border-gray-800 mb-6">
          <button
            type="button"
            onClick={() => setActiveTab('pix')}
            className={cn(
              'h-11 min-h-[44px] rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 cursor-pointer select-none',
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
              'h-11 min-h-[44px] rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 cursor-pointer select-none',
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
            <div className="inline-flex items-center gap-2 rounded-xl bg-amber-500/10 px-4 py-2 text-xs font-bold text-amber-400 border border-amber-500/30">
              <Timer className="h-4 w-4 animate-pulse text-amber-400" />
              <span>QR Code expira em: {formatTimer(secondsLeft)}</span>
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
              <label className="text-xs font-semibold text-gray-300">Código PIX Copia e Cola:</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={pixCopyPasteCode}
                  className="w-full h-11 min-h-[44px] rounded-xl bg-gray-950 px-3 font-mono text-xs sm:text-sm text-gray-300 border border-gray-800 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleCopyPix}
                  className={cn(
                    'h-11 min-h-[44px] px-4 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0',
                    isCopied
                      ? 'bg-emerald-600 text-white'
                      : 'bg-purple-600 hover:bg-purple-500 text-white'
                  )}
                >
                  {isCopied ? (
                    <>
                      <Check className="h-4 w-4" />
                      <span>Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      <span>Copiar</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <p className="text-[11px] text-gray-400">
              Aprovação instantânea de créditos assim que o pagamento PIX for compensado no banco.
            </p>
          </div>
        )}

        {/* Tab Content: Credit Card Form */}
        {activeTab === 'credit_card' && (
          <form onSubmit={handleSubmitCard} className="space-y-4 text-left">
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">Número do Cartão</label>
              <div className="relative">
                <input
                  type="text"
                  required
                  placeholder="0000 0000 0000 0000"
                  value={cardNumber}
                  onChange={handleCardNumberChange}
                  className="w-full h-11 min-h-[44px] rounded-xl bg-gray-950 px-3.5 pr-10 text-base sm:text-sm text-white border border-gray-800 focus:border-purple-500 focus:outline-none"
                />
                <CreditCard className="absolute right-3 top-3 h-5 w-5 text-gray-500" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">Nome no Cartão</label>
              <input
                type="text"
                required
                placeholder="NOME COMO CONSTADO NO CARTÃO"
                value={cardHolder}
                onChange={(e) => setCardHolder(e.target.value.toUpperCase())}
                className="w-full h-11 min-h-[44px] rounded-xl bg-gray-950 px-3.5 text-base sm:text-sm text-white border border-gray-800 focus:border-purple-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Validade (MM/AA)</label>
                <input
                  type="text"
                  required
                  placeholder="MM/AA"
                  value={cardExpiry}
                  onChange={handleExpiryChange}
                  className="w-full h-11 min-h-[44px] rounded-xl bg-gray-950 px-3.5 text-base sm:text-sm text-white border border-gray-800 focus:border-purple-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">CVV</label>
                <input
                  type="password"
                  required
                  maxLength={4}
                  placeholder="123"
                  value={cardCvv}
                  onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, ''))}
                  className="w-full h-11 min-h-[44px] rounded-xl bg-gray-950 px-3.5 text-base sm:text-sm text-white border border-gray-800 focus:border-purple-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">Parcelamento</label>
              <select
                value={installments}
                onChange={(e) => setInstallments(e.target.value)}
                className="w-full h-11 min-h-[44px] rounded-xl bg-gray-950 px-3.5 text-base sm:text-sm text-white border border-gray-800 focus:border-purple-500 focus:outline-none cursor-pointer"
              >
                <option value="1">1x de R$ {currentPrice},00 à vista sem juros</option>
                <option value="2">2x de R$ {(currentPrice / 2).toFixed(2)} sem juros</option>

                <option value="3">3x de R$ {(currentPrice / 3).toFixed(2)} sem juros</option>
                <option value="6">6x de R$ {(currentPrice / 6).toFixed(2)} sem juros</option>
                <option value="12">12x de R$ {(currentPrice / 12).toFixed(2)} sem juros</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-11 min-h-[44px] px-6 rounded-xl text-sm font-bold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white transition-all shadow-lg shadow-purple-600/20 active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer mt-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Processando no Mercado Pago...</span>
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4" />
                  <span>Finalizar Assinatura — R$ {currentPrice},00</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* Security Badges Footer */}
        <div className="mt-6 pt-4 border-t border-gray-800 flex flex-wrap items-center justify-center gap-4 text-[10px] font-bold tracking-wider uppercase text-gray-400">
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
    </div>
  );
};
