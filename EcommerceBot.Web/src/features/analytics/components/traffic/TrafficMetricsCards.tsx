/**
 * src/features/analytics/components/traffic/TrafficMetricsCards.tsx
 *
 * Cards de KPIs de Atribuição de Tráfego: Vendas com Ads, Pedidos UTMs, Ticket Médio e Top Canal.
 */

import React from 'react';
import { TrendingUp, ShoppingBag, Target, Sparkles } from 'lucide-react';
import type { TenantTrafficOverview } from '../../types/traffic.types';

interface TrafficMetricsCardsProps {
  overview: TenantTrafficOverview | null;
}

export const TrafficMetricsCards: React.FC<TrafficMetricsCardsProps> = ({ overview }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Vendas com Ads */}
      <div className="rounded-2xl bg-[#15121B] border border-[#1E293B] p-5 shadow-lg">
        <div className="flex items-center justify-between text-slate-400 text-xs mb-3">
          <span className="font-semibold uppercase tracking-wider">Vendas com Ads</span>
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <TrendingUp className="h-4 w-4" />
          </div>
        </div>
        <div className="text-2xl font-black text-emerald-400">
          R$ {(overview?.total_attributed_revenue_brl || 0).toFixed(2).replace('.', ',')}
        </div>
        <p className="text-[11px] text-slate-400 mt-2">
          Receita diretamente atribuída a campanhas
        </p>
      </div>

      {/* Pedidos com UTMs */}
      <div className="rounded-2xl bg-[#15121B] border border-[#1E293B] p-5 shadow-lg">
        <div className="flex items-center justify-between text-slate-400 text-xs mb-3">
          <span className="font-semibold uppercase tracking-wider">Pedidos com UTMs</span>
          <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <ShoppingBag className="h-4 w-4" />
          </div>
        </div>
        <div className="text-2xl font-black text-white">
          {overview?.total_tracked_orders || 0}
        </div>
        <p className="text-[11px] text-slate-400 mt-2">
          Conversões registradas via Shopify/Nuvemshop
        </p>
      </div>

      {/* Ticket Médio Ads */}
      <div className="rounded-2xl bg-[#15121B] border border-[#1E293B] p-5 shadow-lg">
        <div className="flex items-center justify-between text-slate-400 text-xs mb-3">
          <span className="font-semibold uppercase tracking-wider">Ticket Médio Ads</span>
          <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Target className="h-4 w-4" />
          </div>
        </div>
        <div className="text-2xl font-black text-white">
          R$ {(overview?.average_ticket_brl || 0).toFixed(2).replace('.', ',')}
        </div>
        <p className="text-[11px] text-slate-400 mt-2">
          Valor médio por compra vinda de anúncios
        </p>
      </div>

      {/* Top Canal */}
      <div className="rounded-2xl bg-[#15121B] border border-[#1E293B] p-5 shadow-lg">
        <div className="flex items-center justify-between text-slate-400 text-xs mb-3">
          <span className="font-semibold uppercase tracking-wider">Top Canal</span>
          <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <Sparkles className="h-4 w-4" />
          </div>
        </div>
        <div className="text-xl font-bold text-white truncate">
          {overview?.top_source || 'Direto / Orgânico'}
        </div>
        <p className="text-[11px] text-slate-400 mt-2">
          Origem com maior volume de faturamento
        </p>
      </div>
    </div>
  );
};

export default TrafficMetricsCards;
