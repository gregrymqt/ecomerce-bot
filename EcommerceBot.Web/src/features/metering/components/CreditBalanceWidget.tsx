/**
 * src/features/metering/components/CreditBalanceWidget.tsx
 *
 * Widget principal de exibição de saldo de créditos, telemetria de 30 dias e atalho de recarga.
 * Em conformidade com acessibilidade WCAG 2.1 AA e touch targets mínimos de 44px.
 */

import React from 'react';
import { DollarSign, Zap, AlertTriangle, TrendingUp, Cpu } from 'lucide-react';
import { Button } from '@/components/ui';
import type { TenantCreditBalanceResponse } from '../types';
import { EngineStatusBadge } from './EngineStatusBadge';
import { cn } from '@/lib/utils';

export interface CreditBalanceWidgetProps {
  balance: TenantCreditBalanceResponse | null;
  isLoading?: boolean;
  onTopUp: () => void;
  className?: string;
}

export const CreditBalanceWidget: React.FC<CreditBalanceWidgetProps> = ({
  balance,
  isLoading = false,
  onTopUp,
  className,
}) => {
  if (isLoading) {
    return (
      <div
        role="status"
        aria-label="Carregando saldo de créditos"
        className={cn(
          'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm animate-pulse',
          className
        )}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/3" />
          <div className="h-6 bg-slate-200 dark:bg-slate-800 rounded-full w-1/4" />
        </div>
        <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded w-1/2 mb-4" />
        <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-full mb-6" />
        <div className="h-11 bg-slate-200 dark:bg-slate-800 rounded-lg w-full" />
      </div>
    );
  }

  const creditBalance = balance?.managed_credit_balance ?? 0;
  const isByok = balance?.is_byok_active ?? false;
  const totalTokens = balance?.total_tokens_used_30d ?? 0;
  const totalCost = balance?.estimated_cost_usd_30d ?? 0;

  // Alerta de saldo baixo (< $5.00 e sem BYOK)
  const isLowBalance = creditBalance < 5 && !isByok;

  return (
    <div
      className={cn(
        'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm transition-all',
        className
      )}
    >
      {/* Header Widget */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-lg">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              Créditos & Telemetria
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Consumo de LLM e motor ativo
            </p>
          </div>
        </div>

        <EngineStatusBadge isByokActive={isByok} />
      </div>

      {/* Saldo de Créditos */}
      <div className="mb-5">
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          Saldo Disponível (SaaS)
        </span>
        <div className="flex items-baseline gap-2 mt-1">
          <span className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            ${creditBalance.toFixed(2)}
          </span>
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            USD
          </span>
        </div>
      </div>

      {/* Alerta de Saldo Baixo */}
      {isLowBalance && (
        <div
          role="alert"
          className="flex items-start gap-2.5 p-3 mb-5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-lg text-amber-800 dark:text-amber-300 text-xs sm:text-sm"
        >
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
          <div>
            <strong className="font-semibold">Saldo Baixo:</strong> Adicione créditos para evitar a interrupção no enriquecimento automático de produtos.
          </div>
        </div>
      )}

      {/* Métricas dos Últimos 30 Dias */}
      <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg mb-5 border border-slate-100 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-xs mb-1">
            <Cpu className="w-3.5 h-3.5 text-indigo-500" />
            <span>Tokens 30d</span>
          </div>
          <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
            {totalTokens.toLocaleString('pt-BR')}
          </p>
        </div>

        <div>
          <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-xs mb-1">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
            <span>Custo Est. 30d</span>
          </div>
          <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
            ${totalCost.toFixed(4)}
          </p>
        </div>
      </div>

      {/* Botão de Ação */}
      <Button
        variant="primary"
        size="md"
        onClick={onTopUp}
        aria-label="Recarregar Créditos de IA"
        iconLeft={<DollarSign className="w-4 h-4" />}
        className="w-full min-h-[44px] font-bold"
      >
        Recarregar Créditos
      </Button>
    </div>
  );
};

export default CreditBalanceWidget;
