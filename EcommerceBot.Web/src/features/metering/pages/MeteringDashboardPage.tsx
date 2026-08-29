/**
 * src/features/metering/pages/MeteringDashboardPage.tsx
 *
 * Página Principal do Dashboard de Telemetria e Consumo de Créditos de IA.
 * Consome o hook useMetering e exibe o balanço de créditos, gráficos de tokens e extrato.
 */

import React, { useState } from 'react';
import { Cpu, DollarSign, Activity, RefreshCw, Sparkles, Key } from 'lucide-react';
import { useMetering } from '../hooks';
import {
  CreditBalanceWidget,
  EngineStatusBadge,
  UsageHistoryTable,
  TopUpCreditModal,
} from '../components';
import { Button, Alert } from '@/components/ui';

export const MeteringDashboardPage: React.FC = () => {
  const {
    balance,
    usageLogs,
    isLoadingBalance,
    isLoadingUsage,
    error,
    page,
    changePage,
    applyFilters,
    refetchAll,
  } = useMetering();

  const [isTopUpModalOpen, setIsTopUpModalOpen] = useState(false);

  const isByokActive = balance?.is_byok_active ?? false;
  const totalTokens30d = balance?.total_tokens_used_30d ?? 0;
  const totalCost30d = balance?.estimated_cost_usd_30d ?? 0;

  return (
    <div
      role="main"
      aria-label="Painel de Consumo e Telemetria de IA"
      className="space-y-6 max-w-7xl mx-auto animate-fade-in pb-12"
    >
      {/* Header Principal da Página */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Consumo & Telemetria de IA
            </h1>
            <EngineStatusBadge isByokActive={isByokActive} />
          </div>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 max-w-3xl">
            Acompanhe o saldo de créditos gerenciados, o motor ativo (BYOK vs SaaS) e o extrato em tempo real de tokens consumidos pelas chamadas de LLM.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="md"
            onClick={() => refetchAll()}
            isLoading={isLoadingBalance || isLoadingUsage}
            aria-label="Atualizar Dados de Consumo"
            iconLeft={<RefreshCw className="w-4 h-4" />}
            className="min-h-[44px] font-semibold"
          >
            Atualizar Dados
          </Button>
        </div>
      </header>

      {/* Alerta de Erro Global */}
      {error && (
        <div className="animate-fade-in">
          <Alert variant="error" title="Erro de Telemetria">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <span>{error}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetchAll()}
                className="min-h-[36px]"
              >
                Tentar Novamente
              </Button>
            </div>
          </Alert>
        </div>
      )}

      {/* Grid Superior: Widget de Saldo + Cards Estatísticos */}
      <section aria-label="Resumo de Créditos e Volume de Tokens" className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna 1: Widget Principal de Créditos */}
        <div className="lg:col-span-1">
          <CreditBalanceWidget
            balance={balance}
            isLoading={isLoadingBalance}
            onTopUp={() => setIsTopUpModalOpen(true)}
          />
        </div>

        {/* Coluna 2 & 3: Cards Resumo de Desempenho e Consumo */}
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Card 1: Total de Tokens 30d */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Volume de Tokens (30d)
              </span>
              <div className="p-2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-lg">
                <Cpu className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4">
              <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
                {totalTokens30d.toLocaleString('pt-BR')}
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                Prompt + Completion acumulados
              </p>
            </div>
          </div>

          {/* Card 2: Custo Estimado 30d */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Custo Estimado (30d)
              </span>
              <div className="p-2 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-lg">
                <DollarSign className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4">
              <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
                ${totalCost30d.toFixed(4)} <span className="text-xs font-normal text-slate-400">USD</span>
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <Activity className="w-3.5 h-3.5 text-emerald-500" />
                Custo calculado com base nos modelos utilizados
              </p>
            </div>
          </div>

          {/* Card 3: Status da Rota de Execução */}
          <div className="sm:col-span-2 bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-xl p-5 shadow-md border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="p-3 bg-white/10 rounded-xl backdrop-blur-xs">
                {isByokActive ? (
                  <Key className="w-6 h-6 text-emerald-400" />
                ) : (
                  <Cpu className="w-6 h-6 text-indigo-400" />
                )}
              </div>
              <div>
                <h4 className="text-base font-bold text-white">
                  {isByokActive ? 'Modo Chave Própria (BYOK) Ativo' : 'Modo Créditos Gerenciados (SaaS) Ativo'}
                </h4>
                <p className="text-xs text-slate-300">
                  {isByokActive
                    ? 'As requisições utilizam sua chave OpenRouter configurada. Créditos SaaS não são consumidos.'
                    : 'As requisições utilizam a chave mestre com roteamento otimizado e consomem seus créditos.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Seção Inferior: Tabela de Extrato Detalhado */}
      <section aria-label="Histórico Detalhado de Requisições">
        <UsageHistoryTable
          usageLogs={usageLogs}
          isLoading={isLoadingUsage}
          page={page}
          changePage={changePage}
          applyFilters={applyFilters}
        />
      </section>

      {/* Modal de Recarga de Créditos */}
      <TopUpCreditModal
        isOpen={isTopUpModalOpen}
        onClose={() => setIsTopUpModalOpen(false)}
      />
    </div>
  );
};

export default MeteringDashboardPage;
