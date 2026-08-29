/**
 * src/features/admin/components/growth/CampaignPerformanceTable.tsx
 *
 * Tabela Analítica de Campanhas, ROI, Faturamento MP, Consumo de IA e Margem Real por Canal.
 */

import React from 'react';
import type { CampaignPerformanceRow } from '../../types/growth.types';
import { cn } from '@/lib/utils';

interface CampaignPerformanceTableProps {
  campaigns?: CampaignPerformanceRow[];
}

export const CampaignPerformanceTable: React.FC<CampaignPerformanceTableProps> = ({ campaigns }) => {
  return (
    <div className="rounded-2xl bg-[#15121B] border border-[#1E293B] p-6 shadow-xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">Desempenho por Origem & Campanha</h2>
          <p className="text-xs text-slate-400">
            Cruzamento de cadastros, faturamento, consumo de IA e margem real por canal.
          </p> 
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-[#090D16] text-slate-400 uppercase tracking-wider font-semibold border-b border-[#1E293B]">
            <tr>
              <th className="py-3.5 px-4">Canal / Origem</th>
              <th className="py-3.5 px-4">Campanha</th>
              <th className="py-3.5 px-4">Criativo (ad_id)</th>
              <th className="py-3.5 px-4 text-center">Cadastros</th>
              <th className="py-3.5 px-4 text-center">Pagantes</th>
              <th className="py-3.5 px-4 text-right">Faturamento MP</th>
              <th className="py-3.5 px-4 text-right">Custo IA</th>
              <th className="py-3.5 px-4 text-right">Gasto Ads</th>
              <th className="py-3.5 px-4 text-right">Margem Real</th>
              <th className="py-3.5 px-4 text-center">ROAS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1E293B]">
            {campaigns && campaigns.length > 0 ? (
              campaigns.map((row, idx) => (
                <tr key={idx} className="hover:bg-[#1E293B]/40 transition-colors">
                  <td className="py-3 px-4 font-bold text-white">{row.utm_source}</td>
                  <td className="py-3 px-4 text-slate-300">{row.utm_campaign}</td>
                  <td className="py-3 px-4 font-mono text-slate-400">{row.ad_id || '-'}</td>
                  <td className="py-3 px-4 text-center">{row.signups_count}</td>
                  <td className="py-3 px-4 text-center font-semibold text-emerald-400">
                    {row.paying_customers_count}
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-white">
                    R$ {row.gross_revenue_brl.toFixed(2).replace('.', ',')}
                  </td>
                  <td className="py-3 px-4 text-right text-amber-400">
                    R$ {row.llm_cost_brl.toFixed(2).replace('.', ',')}
                  </td>
                  <td className="py-3 px-4 text-right text-indigo-400">
                    R$ {row.ad_spend_brl.toFixed(2).replace('.', ',')}
                  </td>
                  <td
                    className={cn(
                      'py-3 px-4 text-right font-black',
                      row.net_margin_brl >= 0 ? 'text-emerald-400' : 'text-red-400'
                    )}
                  >
                    R$ {row.net_margin_brl.toFixed(2).replace('.', ',')}
                  </td>
                  <td className="py-3 px-4 text-center font-bold text-white">
                    {row.roas > 0 ? `${row.roas}x` : '-'}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={10} className="py-8 text-center text-slate-500">
                  Nenhuma campanha de tráfego registrada no período selecionado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CampaignPerformanceTable;
