/**
 * src/features/wallet/pages/WalletPage.tsx
 *
 * Página container principal do módulo de Carteira & Créditos.
 * Integra o custom hook useWallet, os cards de resumo/insights, a tabela de extrato
 * e o modal de recargas em uma interface Synthetica Dark de alta performance.
 */

import React, { useState, useMemo } from 'react';
import { Wallet, Sparkles, RefreshCw } from 'lucide-react';
import { useWallet } from '../hooks/useWallet';
import { WalletBalanceCard } from '../components/WalletBalanceCard';
import { UsageInsightsCard } from '../components/UsageInsightsCard';
import { TransactionHistoryTable } from '../components/TransactionHistoryTable';
import { RechargeModal } from '../components/RechargeModal';
import { Button } from '@/components/ui/Button';

export const WalletPage: React.FC = () => {
  // 1. Hook de Estado da Carteira
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

  // 2. Estado Local do Modal de Recarga
  const [isRechargeModalOpen, setIsRechargeModalOpen] = useState<boolean>(false);

  // Cálculo ilustrativo do consumo total do mês com base no extrato
  const monthlyUsage = useMemo(() => {
    return transactions
      .filter((t) => t.type === 'USAGE')
      .reduce((acc, t) => acc + Math.abs(t.amount), 0);
  }, [transactions]);

  return (
    <div className="space-y-8 max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 animate-fadeIn text-slate-100">
      {/* Cabeçalho da Página */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20">
              <Wallet className="w-8 h-8 text-indigo-400" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                Carteira & Créditos
              </h1>
              <p className="text-xs sm:text-sm text-slate-400">
                Gerencie seu saldo de extração e enriquecimento por IA.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Pill Badge Informativa (JetBrains Mono) */}
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

      {/* Alerta de Erro Global */}
      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-sm flex items-center justify-between">
          <span>{error}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetchWallet()}
            className="text-rose-300 hover:text-white"
          >
            Tentar Novamente
          </Button>
        </div>
      )}

      {/* Grid de Cards Superiores (12 Colunas) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* WalletBalanceCard (7 Colunas) */}
        <div className="lg:col-span-7">
          <WalletBalanceCard
            balance={balance}
            loading={loadingBalance}
            onOpenRechargeModal={() => setIsRechargeModalOpen(true)}
          />
        </div>

        {/* UsageInsightsCard (5 Colunas) */}
        <div className="lg:col-span-5">
          <UsageInsightsCard
            monthlyUsage={monthlyUsage}
            successRate={99.2}
          />
        </div>
      </div>

      {/* Seção Inferior: Tabela de Histórico de Movimentações */}
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

      {/* Modal de Recarga (RechargeModal) */}
      <RechargeModal
        isOpen={isRechargeModalOpen}
        onClose={() => setIsRechargeModalOpen(false)}
        onSuccessPayment={() => refetchWallet()}
      />
    </div>
  );
};

export default WalletPage;
