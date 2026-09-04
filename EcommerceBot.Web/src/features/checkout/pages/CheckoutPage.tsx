/**
 * src/features/checkout/pages/CheckoutPage.tsx
 *
 * Página Principal do Checkout Transparente.
 * Layout Synthetica Dark (#090D16 bg, #15121B card, #1E293B border, #10B981 emerald, #4F46E5 indigo).
 * Suporta dinamicamente Assinatura de Planos e Recargas de Saldo da Carteira.
 * Inclui tela triunfante de sucesso pós-pagamento com auto-redirecionamento para o Dashboard.
 */

import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Bot,
  ArrowLeft,
  ShieldCheck,
  QrCode,
  CreditCard,
  HelpCircle,
  CheckCircle2,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCheckout } from '../hooks/useCheckout';
import { OrderSummaryCard, PixPaymentTab, CreditCardPaymentTab } from '../components';
import { SEO } from '@/components/common/SEO';

export const CheckoutPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Detecção de Parâmetros de Origem (Plano vs Recarga Top-up)
  const checkoutType = searchParams.get('type');
  const isTopup = checkoutType === 'topup';
  const rawPlanId = searchParams.get('planId') || searchParams.get('pack') || 'pro-plan';
  const customAmountParam = searchParams.get('amount');

  // Resolução dinâmica de nome e valor
  let planName: string;
  let amountBrl: number;
  let trialDays: number;

  if (isTopup) {
    amountBrl = customAmountParam ? parseFloat(customAmountParam) : 50.0;
    planName = `Recarga de Créditos (R$ ${amountBrl.toFixed(2)})`;
    trialDays = 0;
  } else if (rawPlanId.includes('enterprise')) {
    planName = 'Plano Enterprise AI';
    amountBrl = 497.0;
    trialDays = 14;
  } else if (rawPlanId.includes('starter')) {
    planName = 'Plano Starter AI';
    amountBrl = 97.0;
    trialDays = 7;
  } else {
    planName = 'Plano Pro AI';
    amountBrl = 197.0;
    trialDays = 7;
  }

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
  } = useCheckout(rawPlanId);

  // Timer de Auto-Redirecionamento para o Dashboard quando aprovado (5 segundos)
  const [redirectCountdown, setRedirectCountdown] = useState<number>(5);

  useEffect(() => {
    if (paymentStatus !== 'APPROVED') return;

    const timer = setInterval(() => {
      setRedirectCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          navigate('/dashboard');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [paymentStatus, navigate]);

  return (
    <div className="min-h-screen bg-[#090D16] text-white flex flex-col justify-between selection:bg-emerald-500 selection:text-black">
      <SEO
        title={isTopup ? 'Recarga de Créditos de IA' : `Checkout Seguro - ${planName}`}
        description="Finalize seu pagamento seguro com PIX ou Cartão de Crédito com ativação imediata."
      />

      {/* Header Superior Compacto */}
      <header className="border-b border-[#1E293B] bg-[#15121B]/80 backdrop-blur-md sticky top-0 z-50 px-4 sm:px-8 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Logo & Badge */}
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-emerald-500 flex items-center justify-center shadow-md shadow-indigo-500/20">
              <Bot className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg text-white tracking-tight">ECom-Auto-Bot</span>
                <span className="rounded-full bg-indigo-500/10 px-2 py-0.5 text-[10px] font-bold text-indigo-400 border border-indigo-500/20">
                  {isTopup ? 'CARTEIRA' : 'PRO'}
                </span>
              </div>
              <span className="text-xs text-slate-400 hidden sm:block">
                {isTopup ? 'Recarga Segura de Saldo de IA' : 'Checkout Transparente Seguro'}
              </span>
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
              onClick={() => navigate(isTopup ? '/wallet' : '/plans')}
              className="min-h-[44px] h-11 px-4 rounded-xl bg-[#15121B] hover:bg-[#1E293B] border border-[#1E293B] text-slate-300 hover:text-white text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>{isTopup ? 'Voltar para Carteira' : 'Voltar para Planos'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="max-w-7xl mx-auto w-full px-4 sm:px-8 py-8 sm:py-12 flex-1">
        {/* Banner de Erro */}
        {error && (
          <div className="mb-6 rounded-xl bg-red-500/10 border border-red-500/20 p-4 text-sm text-red-400 flex items-center justify-between">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => handleGeneratePix(rawPlanId)}
              className="text-xs underline font-semibold text-red-300 hover:text-white ml-4 cursor-pointer min-h-[44px] inline-flex items-center"
            >
              Tentar Novamente
            </button>
          </div>
        )}

        {/* TELA DE SUCESSO TRIUNFANTE APÓS APROVAÇÃO */}
        {paymentStatus === 'APPROVED' ? (
          <div className="max-w-2xl mx-auto rounded-3xl bg-[#15121B] border border-emerald-500/30 p-8 sm:p-12 shadow-2xl text-center space-y-6 animate-in fade-in duration-300 relative overflow-hidden before:absolute before:top-0 before:left-0 before:right-0 before:h-1.5 before:bg-gradient-to-r before:from-emerald-500 before:via-teal-400 before:to-indigo-500">
            <div className="w-20 h-20 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20 transition-transform duration-500 scale-105">
              <CheckCircle2 className="h-10 w-10" />
            </div>

            <div className="space-y-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-extrabold text-emerald-400 border border-emerald-500/20">
                <Sparkles className="h-3.5 w-3.5" />
                PAGAMENTO CONFIRMADO
              </span>
              <h1 className="text-2xl sm:text-3xl font-black text-white">
                {isTopup ? 'Créditos Liberados com Sucesso!' : 'Sua Assinatura está Ativa!'}
              </h1>
              <p className="text-sm text-slate-300 max-w-md mx-auto">
                {isTopup
                  ? `O saldo de R$ ${amountBrl.toFixed(2)} já foi adicionado à sua carteira e está pronto para uso.`
                  : `Seu acesso ao ${planName} foi liberado com todos os recursos premium.`}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-[#090D16] border border-[#1E293B] text-xs text-slate-400 flex items-center justify-between">
              <span>Redirecionando automaticamente em:</span>
              <span className="font-mono font-bold text-emerald-400 text-sm">{redirectCountdown}s</span>
            </div>

            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="w-full min-h-[48px] h-12 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-sm sm:text-base transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <span>Acessar Painel Agora</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        ) : (
          /* GRID NORMAL DE CHECKOUT (2 Colunas no Desktop) */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Coluna 1: Resumo do Pedido (5 colunas) */}
            <div className="lg:col-span-5">
              <OrderSummaryCard
                isTopup={isTopup}
                planName={planName}
                monthlyPrice={amountBrl}
                trialDays={trialDays}
              />
            </div>

            {/* Coluna 2: Container de Pagamento com Abas (7 colunas) */}
            <div className="lg:col-span-7 rounded-2xl bg-[#15121B] border border-[#1E293B] p-6 shadow-xl space-y-6">
              <div>
                <h1 className="text-xl font-bold text-white mb-1">Escolha a Forma de Pagamento</h1>
                <p className="text-xs text-slate-400">
                  {isTopup
                    ? 'Seus créditos serão liberados instantaneamente na sua carteira após a confirmação.'
                    : `Seus ${trialDays} dias grátis serão iniciados imediatamente após a confirmação.`}
                </p>
              </div>

              {/* Alternador de Abas PIX / Cartão com A11y role=tablist */}
              <div role="tablist" aria-label="Forma de Pagamento" className="grid grid-cols-2 gap-2 bg-[#090D16] p-1.5 rounded-xl border border-[#1E293B]">
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'PIX'}
                  onClick={() => setActiveTab('PIX')}
                  className={cn(
                    'min-h-[44px] h-11 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500',
                    activeTab === 'PIX'
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                      : 'text-slate-400 hover:text-white hover:bg-[#15121B]'
                  )}
                >
                  <QrCode className="h-4 w-4" />
                  <span>PIX Instantâneo</span>
                </button>

                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'CREDIT_CARD'}
                  onClick={() => setActiveTab('CREDIT_CARD')}
                  className={cn(
                    'min-h-[44px] h-11 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500',
                    activeTab === 'CREDIT_CARD'
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
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
                  onRefreshPix={() => handleGeneratePix(rawPlanId)}
                />
              ) : (
                <CreditCardPaymentTab
                  planId={rawPlanId}
                  amountBrl={amountBrl}
                  loading={loading}
                  submitButtonText={isTopup ? `Recarregar R$ ${amountBrl.toFixed(2)}` : 'Finalizar Assinatura Segura'}
                  onSubmit={async (payload) => {
                    await handleProcessCreditCard(payload);
                  }}
                />
              )}
            </div>
          </div>
        )}
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
              <ShieldCheck className="h-4 w-4 text-indigo-400" />
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
