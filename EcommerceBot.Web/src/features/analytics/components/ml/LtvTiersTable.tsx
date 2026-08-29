/**
 * src/features/analytics/components/ml/LtvTiersTable.tsx
 *
 * Tabela de Projeção de Tiers de LTV (Diamond, Platinum, Gold, Silver, Bronze) para 12 meses.
 */

import React from 'react';
import { Award } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LtvForecast, LtvCustomerTier } from '../../types/ml.types';

interface LtvTiersTableProps {
  forecasts?: LtvForecast[];
}

const getTierBadge = (tier: LtvCustomerTier) => {
  switch (tier) {
    case 'DIAMOND':
      return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20';
    case 'PLATINUM':
      return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
    case 'GOLD':
      return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    case 'SILVER':
      return 'bg-slate-500/10 text-slate-300 border-slate-500/20';
    case 'BRONZE':
    default:
      return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
  }
};

export const LtvTiersTable: React.FC<LtvTiersTableProps> = ({ forecasts }) => {
  return (
    <div className="rounded-2xl bg-[#15121B] border border-[#1E293B] p-6 shadow-xl space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Award className="h-5 w-5 text-amber-400" />
          <h3 className="text-base font-bold text-white">Previsão de Tiers & LTV (12m)</h3>
        </div>
        <span className="text-xs text-slate-400 font-mono">
          {forecasts?.length || 0} clientes
        </span>
      </div>

      <div className="overflow-x-auto max-h-80">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-[#090D16] text-slate-400 uppercase tracking-wider font-semibold border-b border-[#1E293B] sticky top-0">
            <tr>
              <th className="py-2.5 px-3">Cliente</th>
              <th className="py-2.5 px-3">Tier</th>
              <th className="py-2.5 px-3 text-right">Histórico</th>
              <th className="py-2.5 px-3 text-right">LTV Previsto (12m)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1E293B]">
            {forecasts && forecasts.length > 0 ? (
              forecasts.map((f, idx) => (
                <tr key={idx} className="hover:bg-[#1E293B]/30">
                  <td className="py-2.5 px-3 font-mono text-slate-300 truncate max-w-[150px]">{f.customerId}</td>
                  <td className="py-2.5 px-3">
                    <span className={cn('px-2 py-0.5 rounded-md text-[10px] font-bold border', getTierBadge(f.customerTier))}>
                      {f.customerTier}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right text-slate-300">
                    R$ {f.historicalRevenue.toFixed(2).replace('.', ',')}
                  </td>
                  <td className="py-2.5 px-3 text-right font-black text-emerald-400">
                    R$ {f.predictedLtv12m.toFixed(2).replace('.', ',')}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="py-6 text-center text-slate-500">Sem previsões de LTV disponíveis.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default LtvTiersTable;
