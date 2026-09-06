/**
 * src/features/wallet/pages/WalletPage.tsx
 *
 * Hub Financeiro Unificado do SaaS E-commerce Bot.
 * Consolida a gestão de Saldo & Recargas e a visualização & contratação de Planos SaaS.
 * Integra checkout transparente com Mercado Pago (PIX e Cartão de Crédito).
 * Em conformidade estrita com acessibilidade WCAG 2.1 AA e teto de 350 linhas de código.
 */

import React, { useState, useMemo } from 'react';

import { useSearchParams } from 'react-router-dom';
import {
  Wallet,
  Sparkles,
  RefreshCw,
  CreditCard,
  AlertTriangle,
} from 'lucide-react';
import { useWallet } from '../hooks/useWallet';
import {
  WalletBalanceCard,
  UsageInsightsCard,
  TransactionHistoryTable,
  RechargeModal,
  PlansTab,
  UnifiedPaymentModal,
} from '../components';
import { Button, Alert } from '@/components/ui';
import type { SaaSPlan, CheckoutTarget } from '../types';

export const WalletPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  // 1. Estado da Aba Ativa derivado dos SearchParams ('balance' | 'plans')
  const tabParam = searchParams.get('tab');
  const activeTab: 'balance' | 'plans' = tabParam === 'plans' ? 'plans' : 'balance';

  // 2. Hook de Estado da Carteira
  const {
    balance,
    transactions,
    loadingBalance,
    loadingStatement,
    typeFilter,
    setTypeFilter,
    page,
    setPage,
    totalCount,
    refetchWallet,
    error,
  } = useWallet();

  // 3. Estados dos Modais
  const [isRechargeModalOpen, setIsRechargeModalOpen] = useState<boolean>(false);
  const [manualUnifiedModalOpen, setManualUnifiedModalOpen] = useState<boolean>(false);
  const [selectedCheckoutTarget, setSelectedCheckoutTarget] = useState<CheckoutTarget | null>(null);

  // 4. Parâmetros de URL (deep linking de checkout e alertas de redirecionamento)
  const reason = searchParams.get('reason');
  const planIdParam = searchParams.get('planId');

  // Abertura automática derivada de checkout se planId vier na URL
  const urlCheckoutTarget = useMemo<CheckoutTarget | null>(() => {
    if (!planIdParam) return null;
    const planName = planIdParam.toUpperCase();
    const amount = planIdParam === 'starter' ? 97 : planIdParam === 'pro' ? 197 : 970;
    return {
      type: 'plan',
      id: `${planIdParam}-plan`,
      name: `Plano ${planName}`,
      amountBrl: amount,
      credits: planIdParam === 'pro' ? 3000 : 1000,
      billingPeriod: 'monthly',
    };
  }, [planIdParam]);

  const effectiveCheckoutTarget = selectedCheckoutTarget || urlCheckoutTarget;
  const isUnifiedModalOpen = manualUnifiedModalOpen || Boolean(urlCheckoutTarget);

  // Cálculo do consumo total do mês com base no extrato
  const monthlyUsage = useMemo(() => {
    return transactions
      .filter((t) => t.type === 'USAGE')
      .reduce((acc, t) => acc + Math.abs(t.amount), 0);
  }, [transactions]);

  // Handler de seleção de plano na aba Planos
  const handleSelectPlan = (plan: SaaSPlan, isAnnual: boolean) => {
    const amount = isAnnual ? plan.price_annual_brl : plan.price_monthly_brl;
    setSelectedCheckoutTarget({
      type: 'plan',
      id: plan.id,
      name: `${plan.name} (${isAnnual ? 'Anual' : 'Mensal'})`,
      amountBrl: amount,
      credits: plan.credits_included,
      billingPeriod: isAnnual ? 'yearly' : 'monthly',
    });
    setManualUnifiedModalOpen(true);
  };

  const handleCloseUnifiedModal = () => {
    setManualUnifiedModalOpen(false);
    setSelectedCheckoutTarget(null);
    if (planIdParam) {
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('planId');
      setSearchParams(newParams, { replace: true });
    }
  };

  const handleTabChange = (newTab: 'balance' | 'plans') => {
    const newParams = new URLSearchParams(searchParams);
    if (newTab === 'plans') {
      newParams.set('tab', 'plans');
    } else {
      newParams.delete('tab');
    }
    setSearchParams(newParams, { replace: true });
  };


  return (
    <div
      role="main"
      aria-label="Hub Financeiro, Carteira e Planos"
      className="space-y-8 max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 animate-fade-in text-slate-100"
    >
      {/* Cabeçalho da Página */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20">
              <Wallet className="w-8 h-8 text-indigo-400" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                Hub Financeiro
              </h1>
              <p className="text-xs sm:text-sm text-slate-400">
                Gerencie seu saldo, recargas e planos de assinatura do SaaS.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900/80 border border-slate-800 rounded-full text-indigo-300 font-mono text-xs font-semibold shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <span>1 PRODUTO PROCESSADO = 1 CRÉDITO</span>
          </div>

          <Button
            type="button"
            variant="outline"
            size="md"
            onClick={() => refetchWallet()}
            isLoading={loadingBalance || loadingStatement}
            iconLeft={<RefreshCw className="w-4 h-4" />}
            className="min-h-[44px] border-slate-700 text-slate-200 hover:bg-slate-800"
          >
            Atualizar
          </Button>
        </div>
      </div>

      {/* Banner Informativo de Redirecionamento */}
      {reason && (
        <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-200 flex items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
            <span className="text-xs sm:text-sm font-medium">
              {reason === 'insufficient_credits'
                ? 'Seus créditos de processamento acabaram. Recarregue sua carteira ou faça upgrade de plano.'
                : 'Esta funcionalidade requer um plano superior. Escolha um plano abaixo para desbloquear.'}
            </span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              const newParams = new URLSearchParams(searchParams);
              newParams.delete('reason');
              setSearchParams(newParams, { replace: true });
            }}
            className="text-amber-300 hover:text-white min-h-[36px]"
          >
            Dispensar
          </Button>
        </div>
      )}

      {/* Alerta de Erro Global */}
      {error && (
        <div className="animate-fade-in">
          <Alert variant="error" title="Erro de Carregamento">
            <div className="flex items-center justify-between gap-4">
              <span>{error}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => refetchWallet()}
                className="text-rose-300 hover:text-white min-h-[36px] px-3"
              >
                Tentar Novamente
              </Button>
            </div>
          </Alert>
        </div>
      )}

      {/* Abas Principais: Saldo & Recargas vs Planos & Assinaturas */}
      <div
        role="tablist"
        aria-label="Seções do Hub Financeiro"
        className="flex items-center gap-2 p-1.5 bg-slate-900/90 border border-slate-800 rounded-2xl max-w-md"
      >
        <button
          type="button"
          role="tab"
          id="tab-balance"
          aria-selected={activeTab === 'balance'}
          aria-controls="panel-balance"
          onClick={() => handleTabChange('balance')}
          className={`flex items-center justify-center gap-2 flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold transition-all min-h-[44px] cursor-pointer ${
            activeTab === 'balance'
              ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-md shadow-indigo-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Wallet className="w-4 h-4" />
          <span>Saldo & Recargas</span>
        </button>

        <button
          type="button"
          role="tab"
          id="tab-plans"
          aria-selected={activeTab === 'plans'}
          aria-controls="panel-plans"
          onClick={() => handleTabChange('plans')}
          className={`flex items-center justify-center gap-2 flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold transition-all min-h-[44px] cursor-pointer ${
            activeTab === 'plans'
              ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-md shadow-indigo-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>Planos & Assinaturas</span>
        </button>
      </div>

      {/* Painel 1: Saldo & Recargas */}
      {activeTab === 'balance' && (
        <div
          id="panel-balance"
          role="tabpanel"
          aria-labelledby="tab-balance"
          className="space-y-8 animate-fade-in"
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            <div className="lg:col-span-7">
              <WalletBalanceCard
                balance={balance}
                loading={loadingBalance}
                onOpenRechargeModal={() => setIsRechargeModalOpen(true)}
              />
            </div>

            <div className="lg:col-span-5">
              <UsageInsightsCard
                monthlyUsage={monthlyUsage}
                successRate={99.2}
              />
            </div>
          </div>

          <div>
            <TransactionHistoryTable
              transactions={transactions}
              loading={loadingStatement}
              activeFilter={typeFilter}
              onFilterChange={setTypeFilter}
              totalCount={totalCount}
              currentPage={page}
              onPageChange={setPage}
            />
          </div>
        </div>
      )}

      {/* Painel 2: Planos & Assinaturas */}
      {activeTab === 'plans' && (
        <div
          id="panel-plans"
          role="tabpanel"
          aria-labelledby="tab-plans"
          className="animate-fade-in"
        >
          <PlansTab onSelectPlan={handleSelectPlan} />
        </div>
      )}

      {/* Modal de Seleção de Pacotes de Recarga */}
      <RechargeModal
        key={isRechargeModalOpen ? 'open' : 'closed'}
        isOpen={isRechargeModalOpen}
        onClose={() => setIsRechargeModalOpen(false)}
        onSuccessPayment={() => refetchWallet()}
      />

      {/* Modal Unificado de Pagamento (Planos e Checkout) */}
      <UnifiedPaymentModal
        key={isUnifiedModalOpen ? 'open' : 'closed'}
        isOpen={isUnifiedModalOpen}
        target={effectiveCheckoutTarget}
        onClose={handleCloseUnifiedModal}
        onSuccessPayment={() => {
          refetchWallet();
        }}
      />

    </div>
  );
};

export default WalletPage;

