/**
 * src/features/wallet/components/UsageInsightsCard.tsx
 *
 * Componente visual de métricas e consumo com estética Glassmorphism,
 * exibindo o consumo mensal com barra de progresso e taxa de sucesso.
 */

import React from 'react';
import { TrendingUp, BarChart3, Activity } from 'lucide-react';
import { Card } from '@/components/ui/display/Card';
import type { UsageInsightsCardProps } from '../types';

export const UsageInsightsCard: React.FC<UsageInsightsCardProps> = ({
  monthlyUsage,
  successRate = 99.2,
}) => {
  const formattedMonthlyUsage = monthlyUsage.toLocaleString('pt-BR');
  // Porcentagem ilustrativa para a barra de progresso do consumo (ex: capped em 100%)
  const progressPercentage = Math.min(100, Math.max(15, (monthlyUsage / 5000) * 100));

  return (
    <Card
      glass
      className="bg-slate-900/70 backdrop-blur-xl border-slate-800 rounded-xl p-6 relative overflow-hidden before:absolute before:top-0 before:left-0 before:right-0 before:h-[1px] before:bg-gradient-to-r before:from-transparent before:via-indigo-500/50 before:to-transparent flex flex-col justify-between shadow-xl h-full"
    >
      {/* Header do Card com Ícone e Título */}
      <div className="flex items-center gap-2 mb-6">
        <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg border border-indigo-500/20">
          <BarChart3 className="w-5 h-5 text-indigo-400" />
        </div>
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
            Métricas & Consumo
          </h3>
          <p className="text-[11px] text-slate-400">Indicadores operacionais de IA</p>
        </div>
      </div>

      {/* Grid de Métricas Principais */}
      <div className="space-y-5">
        {/* Métrica 1: Consumo do Mês */}
        <div>
          <div className="flex items-center justify-between text-xs text-slate-300 mb-1.5">
            <span className="font-medium flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-indigo-400" />
              Consumo do Mês
            </span>
            <span className="font-mono font-bold text-white">
              {formattedMonthlyUsage} créditos
            </span>
          </div>

          {/* Barra de Progresso Fina (4px) em Indigo */}
          <div className="w-full h-[4px] bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-500"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>

        {/* Métrica 2: Taxa de Sucesso */}
        <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
          <span className="text-xs font-medium text-slate-300">Taxa de Sucesso</span>

          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <span className="font-mono text-sm font-extrabold text-emerald-400">
              {successRate.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default UsageInsightsCard;
