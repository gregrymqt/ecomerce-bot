/**
 * src/features/analytics/components/ml/MlKpiCards.tsx
 *
 * 4 Cards de KPIs de Machine Learning: LTV Projetado 12m, Risco de Churn, Base Analisada e LTV Médio.
 */

import React from 'react';
import { TrendingUp, AlertTriangle, Users, DollarSign } from 'lucide-react';
import type { MlInsightsResponse } from '../../types/ml.types';

interface MlKpiCardsProps {
  insights: MlInsightsResponse | null;
}

export const MlKpiCards: React.FC<MlKpiCardsProps> = ({ insights }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Projeção de LTV (12 Meses) */}
      <div className="rounded-2xl bg-[#15121B] border border-[#1E293B] p-5 shadow-lg">
        <div className="flex items-center justify-between text-slate-400 text-xs mb-3">
          <span className="font-semibold uppercase tracking-wider">LTV Projetado (12m)</span>
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <TrendingUp className="h-4 w-4" />
          </div>
        </div>
        <div className="text-2xl font-black text-emerald-400">
          R$ {(insights?.ltv?.summary.projected_revenue_12m || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        </div>
        <p className="text-[11px] text-slate-400 mt-2">
          Faturamento estimado da base nos próximos 12 meses
        </p>
      </div>

      {/* Clientes em Risco Alto de Churn */}
      <div className="rounded-2xl bg-[#15121B] border border-[#1E293B] p-5 shadow-lg">
        <div className="flex items-center justify-between text-slate-400 text-xs mb-3">
          <span className="font-semibold uppercase tracking-wider">Risco de Churn</span>
          <div className="p-2 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20">
            <AlertTriangle className="h-4 w-4" />
          </div>
        </div>
        <div className="text-2xl font-black text-red-400">
          {insights?.churn?.summary.high_risk_count || 0} clientes
        </div>
        <p className="text-[11px] text-slate-400 mt-2">
          Precisam de ação imediata de retenção
        </p>
      </div>

      {/* Total de Clientes Analisados */}
      <div className="rounded-2xl bg-[#15121B] border border-[#1E293B] p-5 shadow-lg">
        <div className="flex items-center justify-between text-slate-400 text-xs mb-3">
          <span className="font-semibold uppercase tracking-wider">Base Analisada</span>
          <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Users className="h-4 w-4" />
          </div>
        </div>
        <div className="text-2xl font-black text-white">
          {insights?.rfm?.summary.total_customers || 0} clientes
        </div>
        <p className="text-[11px] text-slate-400 mt-2">
          Segmentados por Recência, Frequência e Valor
        </p>
      </div>

      {/* LTV Médio por Cliente */}
      <div className="rounded-2xl bg-[#15121B] border border-[#1E293B] p-5 shadow-lg">
        <div className="flex items-center justify-between text-slate-400 text-xs mb-3">
          <span className="font-semibold uppercase tracking-wider">LTV Médio por Cliente</span>
          <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <DollarSign className="h-4 w-4" />
          </div>
        </div>
        <div className="text-2xl font-black text-purple-400">
          R$ {(insights?.ltv?.summary.avg_projected_ltv_12m || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        </div>
        <p className="text-[11px] text-slate-400 mt-2">
          Valor estimado por cliente individual
        </p>
      </div>
    </div>
  );
};

export default MlKpiCards;
