/**
 * src/features/admin/components/growth/GrowthMetricsCards.tsx
 *
 * Cards de KPIs principais de Unit Economics: CAC Médio, Faturamento MP, Custo de IA e Margem Real.
 */

import React from 'react';
import { DollarSign, TrendingUp, Cpu, BarChart3 } from 'lucide-react';
import type { UnitEconomicsData } from '../../types/growth.types';
import { cn } from '@/lib/utils';

interface GrowthMetricsCardsProps {
  unitEconomics: UnitEconomicsData | null;
}

export const GrowthMetricsCards: React.FC<GrowthMetricsCardsProps> = ({ unitEconomics }) => {
  const isNetProfitPositive = (unitEconomics?.net_profit_brl || 0) >= 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* CAC Médio */}
      <div className="rounded-2xl bg-[#15121B] border border-[#1E293B] p-5 shadow-lg relative overflow-hidden">
        <div className="flex items-center justify-between text-slate-400 text-xs mb-3">
          <span className="font-semibold uppercase tracking-wider">CAC Médio</span>
          <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <DollarSign className="h-4 w-4" />
          </div>
        </div>
        <div className="text-2xl font-black text-white">
          R$ {(unitEconomics?.average_cac_brl || 0).toFixed(2).replace('.', ',')}
        </div>
        <p className="text-[11px] text-slate-400 mt-2">
          Custo de mídia por assinante pagante adquirido
        </p>
      </div>

      {/* Faturamento MP */}
      <div className="rounded-2xl bg-[#15121B] border border-[#1E293B] p-5 shadow-lg relative overflow-hidden">
        <div className="flex items-center justify-between text-slate-400 text-xs mb-3">
          <span className="font-semibold uppercase tracking-wider">Faturamento MP</span>
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <TrendingUp className="h-4 w-4" />
          </div>
        </div>
        <div className="text-2xl font-black text-emerald-400">
          R$ {(unitEconomics?.total_gross_revenue_brl || 0).toFixed(2).replace('.', ',')}
        </div>
        <p className="text-[11px] text-slate-400 mt-2">
          Total transacionado via Mercado Pago no período
        </p>
      </div>

      {/* Custo de IA (LLM / Scraping) */}
      <div className="rounded-2xl bg-[#15121B] border border-[#1E293B] p-5 shadow-lg relative overflow-hidden">
        <div className="flex items-center justify-between text-slate-400 text-xs mb-3">
          <span className="font-semibold uppercase tracking-wider">Custo de Tokens IA</span>
          <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Cpu className="h-4 w-4" />
          </div>
        </div>
        <div className="text-2xl font-black text-amber-400">
          R$ {(unitEconomics?.total_llm_cost_brl || 0).toFixed(2).replace('.', ',')}
        </div>
        <p className="text-[11px] text-slate-400 mt-2">
          Consumo real de scraping e inferência LLM
        </p>
      </div>

      {/* Margem Líquida Real */}
      <div className="rounded-2xl bg-[#15121B] border border-[#1E293B] p-5 shadow-lg relative overflow-hidden">
        <div className="flex items-center justify-between text-slate-400 text-xs mb-3">
          <span className="font-semibold uppercase tracking-wider">Margem Líquida Real</span>
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <BarChart3 className="h-4 w-4" />
          </div>
        </div>
        <div className={cn('text-2xl font-black', isNetProfitPositive ? 'text-emerald-400' : 'text-red-400')}>
          R$ {(unitEconomics?.net_profit_brl || 0).toFixed(2).replace('.', ',')}
        </div>
        <p className="text-[11px] text-slate-400 mt-2">
          Receita - (Gasto em Ads + Custo de IA)
        </p>
      </div>
    </div>
  );
};

export default GrowthMetricsCards;
