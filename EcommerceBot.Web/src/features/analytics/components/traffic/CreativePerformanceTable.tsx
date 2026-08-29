/**
 * src/features/analytics/components/traffic/CreativePerformanceTable.tsx
 *
 * Tabela de Atribuição e Faturamento por Criativo de Anúncio (Meta Ads, Google Ads).
 */

import React from 'react';
import type { CreativePerformance } from '../../types/traffic.types';

interface CreativePerformanceTableProps {
  creatives?: CreativePerformance[];
}

export const CreativePerformanceTable: React.FC<CreativePerformanceTableProps> = ({ creatives }) => {
  return (
    <div className="rounded-2xl bg-[#15121B] border border-[#1E293B] p-6 shadow-xl space-y-4">
      <div>
        <h2 className="text-lg font-bold text-white">Faturamento por Criativo de Anúncio</h2>
        <p className="text-xs text-slate-400">
          Descubra exatamente quais criativos (ad_id) e vídeos do Meta Ads / Google Ads geraram vendas na sua loja.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-[#090D16] text-slate-400 uppercase tracking-wider font-semibold border-b border-[#1E293B]">
            <tr>
              <th className="py-3.5 px-4">Criativo (ad_id)</th>
              <th className="py-3.5 px-4">Campanha</th>
              <th className="py-3.5 px-4">Canal</th>
              <th className="py-3.5 px-4 text-center">Pedidos</th>
              <th className="py-3.5 px-4 text-right">Faturamento Total</th>
              <th className="py-3.5 px-4 text-right">Ticket Médio</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1E293B]">
            {creatives && creatives.length > 0 ? (
              creatives.map((c, idx) => (
                <tr key={idx} className="hover:bg-[#1E293B]/40 transition-colors">
                  <td className="py-3.5 px-4 font-mono font-bold text-indigo-400">{c.ad_id}</td>
                  <td className="py-3.5 px-4 text-slate-200">{c.campaign}</td>
                  <td className="py-3.5 px-4 text-slate-400">{c.source}</td>
                  <td className="py-3.5 px-4 text-center font-semibold text-white">{c.orders_count}</td>
                  <td className="py-3.5 px-4 text-right font-black text-emerald-400">
                    R$ {c.total_revenue_brl.toFixed(2).replace('.', ',')}
                  </td>
                  <td className="py-3.5 px-4 text-right font-semibold text-white">
                    R$ {c.average_ticket_brl.toFixed(2).replace('.', ',')}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-500">
                  Nenhum pedido atribuído a criativo específico ainda. Instale o tracker.js na sua loja para começar a rastrear.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CreativePerformanceTable;
