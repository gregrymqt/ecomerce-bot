/**
 * src/features/wallet/components/UsageInsightsCard.tsx
 *
 * Componente visual de métricas e consumo com estética Glassmorphism,
 * exibindo o consumo mensal com barra de progresso e taxa de sucesso.
 */

import React from 'react';
import { TrendingUp, BarChart3, Activity } from 'lucide-react';
import { Card } from '@/components/ui/display/Card';

export interface UsageInsightsCardProps {
  monthlyUsage: number;
  successRate?: number;
}

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
      className="bg-[#1d1a23]/70 backdrop-blur-xl border-[#494454] rounded-xl p-6 relative overflow-hidden before:absolute before:top-0 before:left-0 before:right-0 before:h-[1px] before:bg-gradient-to-r before:from-transparent before:via-[#d0bcff]/50 before:to-transparent flex flex-col justify-between shadow-xl"
    >
      {/* Header do Card com Ícone e Título */}
      <div className="flex items-center gap-2 mb-6">
        <div className="p-2 bg-[#a078ff]/10 text-[#d0bcff] rounded-lg border border-[#a078ff]/20">
          <BarChart3 className="w-5 h-5 text-[#a078ff]" />
        </div>
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[#cabed0]">
            Métricas & Consumo
          </h3>
          <p className="text-[11px] text-[#978e9e]">Indicadores operacionais de IA</p>
        </div>
      </div>

      {/* Grid de Métricas Principais */}
      <div className="space-y-5">
        {/* Métrica 1: Consumo do Mês */}
        <div>
          <div className="flex items-center justify-between text-xs text-[#cabed0] mb-1.5">
            <span className="font-medium flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-[#a078ff]" />
              Consumo do Mês
            </span>
            <span className="font-mono font-bold text-[#e7e0ed]">
              {formattedMonthlyUsage} créditos
            </span>
          </div>

          {/* Barra de Progresso Fina (4px) em Gradiente Violeta */}
          <div className="w-full h-[4px] bg-[#342f3d] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#a078ff] to-[#6d3bd7] rounded-full transition-all duration-500"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>

        {/* Métrica 2: Taxa de Sucesso */}
        <div className="pt-3 border-t border-[#342f3d]/60 flex items-center justify-between">
          <span className="text-xs font-medium text-[#cabed0]">Taxa de Sucesso</span>

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

