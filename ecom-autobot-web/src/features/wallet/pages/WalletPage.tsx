/**
 * src/features/wallet/pages/WalletPage.tsx
 *
 * Página container principal do módulo de Carteira & Créditos.
 * Integra o custom hook useWallet, os cards de resumo/insights, a tabela de extrato
 * e o modal de recargas em uma interface Synthetica Dark de alta performance.
 */

import React, { useState, useMemo } from 'react';
import { Wallet, Sparkles, X, CheckCircle2, ShieldCheck, DollarSign, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../hooks/useWallet';
import { WalletBalanceCard } from '../components/WalletBalanceCard';
import { UsageInsightsCard } from '../components/UsageInsightsCard';
import { TransactionHistoryTable } from '../components/TransactionHistoryTable';
import { Button } from '@/components/ui/Button';

export const WalletPage: React.FC = () => {
  const navigate = useNavigate();

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
  const [selectedPack, setSelectedPack] = useState<string>('pack_50');

  // Cálculo ilustrativo do consumo total do mês com base no extrato
  const monthlyUsage = useMemo(() => {
    return transactions
      .filter((t) => t.type === 'USAGE')
      .reduce((acc, t) => acc + Math.abs(t.amount), 0);
  }, [transactions]);

  // Opções de Pacote para o Modal de Recarga
  const rechargePackages = [
    {
      id: 'pack_20',
      amountBrl: 20,
      credits: 200,
      label: 'Pacote Starter',
      badge: '~200 produtos enriquecidos',
    },
    {
      id: 'pack_50',
      amountBrl: 50,
      credits: 550,
      label: 'Pacote Pro',
      badge: '+10% Bônus • ~550 produtos',
      popular: true,
    },
    {
      id: 'pack_100',
      amountBrl: 100,
      credits: 1200,
      label: 'Pacote Enterprise',
      badge: '+20% Bônus • ~1.200 produtos',
    },
  ];

  const handleProceedCheckout = (packId: string, amount: number) => {
    setIsRechargeModalOpen(false);
    navigate(`/checkout?type=recharge&pack=${packId}&amount=${amount}`);
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 animate-fadeIn text-[#e7e0ed]">
      {/* Cabeçalho da Página */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[#3c3647]">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#a078ff]/10 text-[#d0bcff] rounded-xl border border-[#a078ff]/20">
              <Wallet className="w-8 h-8 text-[#a078ff]" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#e7e0ed]">
                Carteira & Créditos
              </h1>
              <p className="text-xs sm:text-sm text-[#978e9e]">
                Gerencie seu saldo de extração e enriquecimento por IA.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Pill Badge Informativa (JetBrains Mono) */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#25202e] border border-[#494454] rounded-full text-[#d0bcff] font-mono text-xs font-semibold shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-[#a078ff] shrink-0" />
            <span>1 PRODUTO PROCESSADO = 1 CRÉDITO</span>
          </div>

          <Button
            type="button"
            variant="outline"
            size="md"
            onClick={() => refetchWallet()}
            isLoading={loadingBalance || loadingStatement}
            iconLeft={<RefreshCw className="w-4 h-4" />}
            className="min-h-[44px] border-[#494454] text-[#e7e0ed] hover:bg-[#2e2938]"
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

      {/* Boilerplate / Modal de Recarga (RechargeModal) */}
      {isRechargeModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn"
          role="dialog"
          aria-modal="true"
          aria-labelledby="recharge-modal-title"
          onClick={() => setIsRechargeModalOpen(false)}
        >
          <div
            className="relative w-full max-w-lg bg-[#1a1721] border border-[#494454] rounded-2xl shadow-2xl overflow-hidden text-[#e7e0ed]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header do Modal */}
            <div className="p-6 border-b border-[#383344] flex items-center justify-between bg-[#221e2c]">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-[#a078ff]/10 text-[#d0bcff] rounded-xl border border-[#a078ff]/20">
                  <Wallet className="w-5 h-5 text-[#a078ff]" />
                </div>
                <div>
                  <h2 id="recharge-modal-title" className="text-lg font-bold text-[#e7e0ed]">
                    Recarregar Créditos
                  </h2>
                  <p className="text-xs text-[#978e9e]">
                    Selecione um pacote de créditos para sua carteira
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsRechargeModalOpen(false)}
                aria-label="Fechar Modal"
                className="p-2 rounded-lg text-[#978e9e] hover:text-white hover:bg-[#342f3d] transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Opções de Pacotes */}
            <div className="p-6 space-y-3">
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#978e9e] mb-2">
                Pacotes de Recarga
              </label>

              {rechargePackages.map((pkg) => {
                const isSelected = pkg.id === selectedPack;

                return (
                  <div
                    key={pkg.id}
                    onClick={() => setSelectedPack(pkg.id)}
                    className={`relative flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer transition-all ${
                      isSelected
                        ? 'border-[#a078ff] bg-[#a078ff]/10 shadow-md'
                        : 'border-[#383344] bg-[#221e2c] hover:border-[#494454]'
                    }`}
                  >
                    {pkg.popular && (
                      <span className="absolute -top-2.5 right-4 px-2.5 py-0.5 bg-[#a078ff] text-white text-[10px] font-extrabold uppercase tracking-wide rounded-full shadow-xs">
                        Mais Popular
                      </span>
                    )}

                    <div className="flex items-center gap-3">
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                          isSelected
                            ? 'border-[#a078ff] bg-[#a078ff] text-white'
                            : 'border-[#494454]'
                        }`}
                      >
                        {isSelected && <CheckCircle2 className="w-4 h-4 fill-current" />}
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-[#e7e0ed]">{pkg.label}</h3>
                        <p className="text-xs text-[#978e9e]">{pkg.badge}</p>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-base font-extrabold text-[#e7e0ed]">
                        R$ {pkg.amountBrl}
                      </div>
                      <div className="text-[11px] font-mono text-[#a078ff]">
                        {pkg.credits} CRD
                      </div>
                    </div>
                  </div>
                );
              })}

              <div className="flex items-center gap-2 pt-2 text-xs text-[#978e9e]">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Pagamento 100% seguro via Mercado Pago (PIX ou Cartão).</span>
              </div>
            </div>

            {/* Footer do Modal */}
            <div className="p-6 border-t border-[#383344] bg-[#221e2c] flex items-center justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={() => setIsRechargeModalOpen(false)}
                className="border-[#494454] text-[#e7e0ed] min-h-[44px]"
              >
                Cancelar
              </Button>

              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={() => {
                  const targetPack = rechargePackages.find((p) => p.id === selectedPack);
                  if (targetPack) {
                    handleProceedCheckout(targetPack.id, targetPack.amountBrl);
                  }
                }}
                iconLeft={<DollarSign className="w-4 h-4" />}
                className="bg-gradient-to-r from-[#a078ff] to-[#6d3bd7] text-white font-semibold min-h-[44px]"
              >
                Ir para Pagamento
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WalletPage;
