/**
 * src/features/wallet/pages/WalletPage.tsx
 *
 * Hub Financeiro Unificado do SaaS E-commerce Bot (Ledger Pattern).
 * Apresenta Saldo Atual, Vitrine de Pacotes de Recarga Avulsa e Extrato do Ledger em fluxo único.
 * Elimina completamente a semântica legada de assinaturas mensais/anuais.
 * Em conformidade estrita com acessibilidade WCAG 2.1 AA e teto de 350 linhas de código.
 */

import React, { useState, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Wallet,
  Sparkles,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { useWallet } from '../hooks/useWallet';
import { useCreditPackages } from '../hooks/useCreditPackages';
import {
  WalletBalanceCard,
  UsageInsightsCard,
  CreditPackagesGrid,
  TransactionHistoryTable,
  UnifiedPaymentModal,
} from '../components';
import { Button, Alert } from '@/components/ui';
import type { RechargePackage, CheckoutTarget } from '../types';

export const WalletPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  // 1. Hooks de Carteira e de Pacotes de Recarga
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
    error: walletError,
  } = useWallet();

  const {
    packages,
    loading: loadingPackages,
    refetchPackages,
    error: packagesError,
  } = useCreditPackages();

  // 2. Estados do Modal Unificado de Pagamento
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [selectedCheckoutTarget, setSelectedCheckoutTarget] = useState<CheckoutTarget | null>(null);

  // 3. Parâmetros de URL (deep linking de recarga e alertas)
  const reason = searchParams.get('reason');
  const packageParam = searchParams.get('package');

  // Seleção automática derivada de query params se package vier na URL
  const urlCheckoutTarget = useMemo<CheckoutTarget | null>(() => {
    if (!packageParam || packages.length === 0) return null;
    const found = packages.find(
      (p) => p.id === packageParam || p.name.toLowerCase().includes(packageParam.toLowerCase())
    );
    if (!found) return null;
    return {
      type: 'recharge',
      id: found.id,
      name: `Pacote ${found.name} (${found.credits.toLocaleString('pt-BR')} créditos)`,
      amountBrl: found.price_brl,
      credits: found.credits,
      description: found.description || `Recarga avulsa de ${found.credits} créditos perpétuos`,
    };
  }, [packageParam, packages]);

  const effectiveCheckoutTarget = selectedCheckoutTarget || urlCheckoutTarget;
  const isUnifiedModalOpen = isModalOpen || Boolean(urlCheckoutTarget);

  // Cálculo do consumo total do mês com base no extrato
  const monthlyUsage = useMemo(() => {
    return transactions
      .filter((t) => t.type === 'USAGE' || t.type === 'PRODUCT_ENRICHMENT' || t.type === 'ML_ANALYSIS')
      .reduce((acc, t) => acc + Math.abs(t.amount), 0);
  }, [transactions]);

  // Handler de seleção de pacote na vitrine
  const handleSelectPackage = useCallback((pkg: RechargePackage) => {
    setSelectedCheckoutTarget({
      type: 'recharge',
      id: pkg.id,
      name: `Pacote ${pkg.name} (${pkg.credits.toLocaleString('pt-BR')} créditos)`,
      amountBrl: pkg.price_brl,
      credits: pkg.credits,
      description: pkg.description || `Recarga avulsa de ${pkg.credits} créditos perpétuos`,
    });
    setIsModalOpen(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
    setSelectedCheckoutTarget(null);
    if (packageParam) {
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('package');
      setSearchParams(newParams, { replace: true });
    }
  }, [packageParam, searchParams, setSearchParams]);

  // Scroll suave para a vitrine de pacotes ao clicar no botão do card de saldo
  const handleScrollToPackages = useCallback(() => {
    const el = document.getElementById('credit-packages-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    } else if (packages.length > 0) {
      const proPkg = packages.find((p) => p.is_popular) || packages[0];
      handleSelectPackage(proPkg);
    }
  }, [packages, handleSelectPackage]);

  const handleRefetchAll = useCallback(() => {
    void refetchWallet();
    void refetchPackages();
  }, [refetchWallet, refetchPackages]);

  const combinedError = walletError || packagesError;

  return (
    <div
      role="main"
      aria-label="Hub Financeiro, Carteira e Pacotes de Créditos"
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
                Carteira & Créditos de IA
              </h1>
              <p className="text-xs sm:text-sm text-slate-400">
                Gerencie seu saldo de créditos e adquira recargas avulsas perpétuas sob demanda.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900/80 border border-slate-800 rounded-full text-indigo-300 font-mono text-xs font-semibold shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <span>1 PRODUTO ENRIQUECIDO = 1 CRÉDITO</span>
          </div>

          <Button
            type="button"
            variant="outline"
            size="md"
            onClick={handleRefetchAll}
            isLoading={loadingBalance || loadingStatement || loadingPackages}
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
              Seus créditos de processamento acabaram. Escolha um pacote de recarga abaixo para reativar as rotas de IA imediatamente.
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
      {combinedError && (
        <div className="animate-fade-in">
          <Alert variant="error" title="Erro de Carregamento">
            <div className="flex items-center justify-between gap-4">
              <span>{combinedError}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleRefetchAll}
                className="text-rose-300 hover:text-white min-h-[36px] px-3"
              >
                Tentar Novamente
              </Button>
            </div>
          </Alert>
        </div>
      )}

      {/* Seção 1: Saldo Disponível & Insights de Consumo */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-7">
          <WalletBalanceCard
            balance={balance}
            loading={loadingBalance}
            onRechargeClick={handleScrollToPackages}
          />
        </div>

        <div className="lg:col-span-5">
          <UsageInsightsCard
            monthlyUsage={monthlyUsage}
            successRate={99.8}
          />
        </div>
      </div>

      {/* Seção 2: Vitrine de Pacotes de Recarga Avulsa */}
      <div id="credit-packages-section" className="pt-2">
        <CreditPackagesGrid
          packages={packages}
          loading={loadingPackages}
          onSelectPackage={handleSelectPackage}
        />
      </div>

      {/* Seção 3: Extrato Auditável do Ledger de Créditos */}
      <div className="pt-2">
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

      {/* Modal Unificado de Pagamento Transparente Mercado Pago montado sob demanda */}
      {isUnifiedModalOpen && (
        <UnifiedPaymentModal
          key={effectiveCheckoutTarget?.id ?? 'open'}
          isOpen={isUnifiedModalOpen}
          target={effectiveCheckoutTarget}
          onClose={handleCloseModal}
          onSuccessPayment={() => {
            handleRefetchAll();
          }}
        />
      )}
    </div>
  );
};

export default WalletPage;
