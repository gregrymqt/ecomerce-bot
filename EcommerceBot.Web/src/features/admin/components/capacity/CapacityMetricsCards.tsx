import React from 'react';
import { Coins, Clock, Zap, TrendingUp } from 'lucide-react';
import type { ConsolidatedCapacity } from '../../types/aiCapacity.types';
import { cn } from '@/lib/utils';

interface CapacityMetricsCardsProps {
  consolidated?: ConsolidatedCapacity;
}

export const CapacityMetricsCards: React.FC<CapacityMetricsCardsProps> = ({ consolidated }) => {
  const isCritical = consolidated?.isCritical ?? false;
  const runwayDays = consolidated?.consolidatedRunwayDays ?? 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Saldo Total */}
      <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-5 shadow-xl">
        <div className="flex items-center justify-between text-slate-400 text-xs mb-2 font-semibold uppercase tracking-wider">
          <span>Saldo Total em Caixa</span>
          <Coins className="w-4 h-4 text-emerald-400" />
        </div>
        <div className="text-2xl sm:text-3xl font-black text-emerald-400">
          ${(consolidated?.currentTotalBalanceUsd ?? 0).toFixed(2)} USD
        </div>
        <p className="text-[11px] text-slate-400 mt-2">
          Disponível somando DeepSeek, Gemini e OpenRouter
        </p>
      </div>

      {/* 2. Runway */}
      <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-5 shadow-xl">
        <div className="flex items-center justify-between text-slate-400 text-xs mb-2 font-semibold uppercase tracking-wider">
          <span>Autonomia (Runway)</span>
          <Clock className="w-4 h-4 text-sky-400" />
        </div>
        <div
          className={cn(
            'text-2xl sm:text-3xl font-black',
            isCritical ? 'text-rose-400' : 'text-sky-400'
          )}
        >
          {runwayDays >= 900 ? 'Sem consumo' : `${runwayDays} dias`}
        </div>
        <p className="text-[11px] text-slate-400 mt-2">
          Tempo estimado antes do saldo zerar no ritmo atual
        </p>
      </div>

      {/* 3. Burn Rate */}
      <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-5 shadow-xl">
        <div className="flex items-center justify-between text-slate-400 text-xs mb-2 font-semibold uppercase tracking-wider">
          <span>Burn Rate Diário</span>
          <Zap className="w-4 h-4 text-amber-400" />
        </div>
        <div className="text-2xl sm:text-3xl font-black text-white">
          ${(consolidated?.dailyBurnRateUsdTotal ?? 0).toFixed(4)} /dia
        </div>
        <p className="text-[11px] text-slate-400 mt-2">
          {(consolidated?.dailyBurnRateTokensTotal ?? 0).toLocaleString()} tokens consumidos/dia
        </p>
      </div>

      {/* 4. Recarga Recomendada */}
      <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-5 shadow-xl">
        <div className="flex items-center justify-between text-slate-400 text-xs mb-2 font-semibold uppercase tracking-wider">
          <span>Recarga Recomendada</span>
          <TrendingUp className="w-4 h-4 text-indigo-400" />
        </div>
        <div className="text-2xl sm:text-3xl font-black text-indigo-400">
          ${(consolidated?.recommendedTopupUsd ?? 0).toFixed(2)} USD
        </div>
        <p className="text-[11px] text-slate-400 mt-2">
          Sugerido para manter 30 dias de autonomia
        </p>
      </div>
    </div>
  );
};

export default CapacityMetricsCards;
