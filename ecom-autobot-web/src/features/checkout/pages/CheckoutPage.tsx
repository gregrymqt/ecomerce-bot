/**
 * src/features/checkout/pages/CheckoutPage.tsx
 *
 * Página Principal do Checkout Transparente.
 * Layout Synthetica Dark (#090D16 bg, #15121B card, #1E293B border, #8B5CF6 violet, #10B981 emerald).
 * Grid 2 colunas no desktop com resumo do pedido e alternância entre PIX e Cartão de Crédito.
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Bot, ArrowLeft, ShieldCheck, QrCode, CreditCard, HelpCircle } from 'lucide-react';
import { cn } from '@/utils/cn';
import { useCheckout } from '../hooks/useCheckout';
import { OrderSummaryCard } from '../components/OrderSummaryCard';
import { PixPaymentTab } from '../components/PixPaymentTab';
import { CreditCardPaymentTab } from '../components/CreditCardPaymentTab';

export const CheckoutPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    activeTab,
    setActiveTab,
    pixData,
    formattedTimeLeft,
    isCopied,
    loading,
    error,
    paymentStatus,
    copyPixToClipboard,
    handleGeneratePix,
    handleProcessCreditCard,
  } = useCheckout('pro-plan');

  return (
    <div className="min-h-screen bg-[#090D16] text-slate-100 flex flex-col justify-between selection:bg-violet-500 selection:text-white">
      {/* Header Superior Compacto */}
      <header className="border-b border-[#1E293B] bg-[#15121B]/80 backdrop-blur-md sticky top-0 z-50 px-4 sm:px-8 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Logo & Badge */}
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-500 flex items-center justify-center shadow-md shadow-violet-500/20">
              <Bot className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg text-white tracking-tight">ECom-Auto-Bot</span>
                <span className="rounded-full bg-violet-500/10 px-2 py-0.5 text-[10px] font-bold text-violet-400 border border-violet-500/20">
                  V1.0 PRO
                </span>
              </div>
              <span className="text-xs text-slate-400 hidden sm:block">Checkout Transparente Seguro</span>
            </div>
          </div>

          {/* Ações do Header */}
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-full">
              <ShieldCheck className="h-4 w-4" />
              <span className="font-semibold">Ambiente Criptografado</span>
            </div>

            <button
              type="button"
              onClick={() => navigate('/plans')}
              className="min-h-[44px] h-11 px-4 rounded-xl bg-[#15121B] hover:bg-[#1E293B] border border-[#1E293B] text-slate-300 hover:text-white text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Voltar para Planos</span>
            </button>
          </div>
        </div>
      </header>

      {/* Conteúdo Principal (Grid em 2 colunas no Desktop) */}
      <main className="max-w-7xl mx-auto w-full px-4 sm:px-8 py-8 sm:py-12 flex-1">
        {/* Banner de Erro em Português */}
        {error && (
          <div className="mb-6 rounded-xl bg-red-500/10 border border-red-500/20 p-4 text-sm text-red-400 flex items-center justify-between">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => handleGeneratePix('pro-plan')}
              className="text-xs underline font-semibold text-red-300 hover:text-white ml-4 cursor-pointer"
            >
              Tentar Novamente
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Coluna 1: Resumo do Pedido (5 colunas) */}
          <div className="lg:col-span-5">
            <OrderSummaryCard planName="Plano Pro AI" monthlyPrice={197.0} trialDays={7} />
          </div>

          {/* Coluna 2: Container de Pagamento com Abas (7 colunas) */}
          <div className="lg:col-span-7 rounded-2xl bg-[#15121B] border border-[#1E293B] p-6 shadow-xl space-y-6">
            <div>
              <h1 className="text-xl font-bold text-white mb-1">Escolha a Forma de Pagamento</h1>
              <p className="text-xs text-slate-400">
                Seus 7 dias grátis serão iniciados imediatamente após a confirmação.
              </p>
            </div>

            {/* Alternador de Abas PIX / Cartão */}
            <div className="grid grid-cols-2 gap-2 bg-[#090D16] p-1.5 rounded-xl border border-[#1E293B]">
              <button
                type="button"
                onClick={() => setActiveTab('PIX')}
                className={cn(
                  'min-h-[44px] h-11 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer',
                  activeTab === 'PIX'
                    ? 'bg-violet-600 text-white shadow-md shadow-violet-600/20'
                    : 'text-slate-400 hover:text-white hover:bg-[#15121B]'
                )}
              >
                <QrCode className="h-4 w-4" />
                <span>PIX Instantâneo</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('CREDIT_CARD')}
                className={cn(
                  'min-h-[44px] h-11 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer',
                  activeTab === 'CREDIT_CARD'
                    ? 'bg-violet-600 text-white shadow-md shadow-violet-600/20'
                    : 'text-slate-400 hover:text-white hover:bg-[#15121B]'
                )}
              >
                <CreditCard className="h-4 w-4" />
                <span>Cartão de Crédito</span>
              </button>
            </div>

            {/* Conteúdo da Aba Ativa */}
            {activeTab === 'PIX' ? (
              <PixPaymentTab
                pixData={pixData}
                formattedTimeLeft={formattedTimeLeft}
                isCopied={isCopied}
                paymentStatus={paymentStatus}
                loading={loading}
                onCopyPix={copyPixToClipboard}
                onRefreshPix={() => handleGeneratePix('pro-plan')}
              />
            ) : (
              <CreditCardPaymentTab
                planId="pro-plan"
                loading={loading}
                onSubmit={async (payload) => {
                  await handleProcessCreditCard(payload);
                }}
              />
            )}
          </div>
        </div>
      </main>

      {/* Rodapé com Selos de Confiança */}
      <footer className="border-t border-[#1E293B] bg-[#15121B]/50 py-6 px-4 sm:px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <div className="flex flex-wrap items-center justify-center gap-6">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              <span>Segurança SSL 256-Bits</span>
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-violet-400" />
              <span>Mercado Pago Verified Partner</span>
            </div>
            <div className="flex items-center gap-2">
              <HelpCircle className="h-4 w-4 text-slate-400" />
              <span>Cancelamento Fácil a 1 Clique</span>
            </div>
          </div>
          <p>© {new Date().getFullYear()} ECom-Auto-Bot. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
};

export default CheckoutPage;
