/**
 * src/features/analytics/components/ml/RfmSegmentationTable.tsx
 *
 * Tabela de Segmentação RFM de Clientes (Recência, Frequência, Valor Monetário).
 */

import React from 'react';
import { Users } from 'lucide-react';
import type { RfmCustomer } from '../../types/ml.types';

interface RfmSegmentationTableProps {
  customers?: RfmCustomer[];
}

export const RfmSegmentationTable: React.FC<RfmSegmentationTableProps> = ({ customers }) => {
  return (
    <div className="rounded-2xl bg-[#15121B] border border-[#1E293B] p-6 shadow-xl space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-indigo-400" />
          <h3 className="text-base font-bold text-white">Segmentação RFM da Base</h3>
        </div>
        <span className="text-xs text-slate-400 font-mono">
          {customers?.length || 0} registros
        </span>
      </div>

      <div className="overflow-x-auto max-h-80">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-[#090D16] text-slate-400 uppercase tracking-wider font-semibold border-b border-[#1E293B] sticky top-0">
            <tr>
              <th className="py-2.5 px-3">Cliente</th>
              <th className="py-2.5 px-3">Segmento</th>
              <th className="py-2.5 px-3 text-center">Score RFM</th>
              <th className="py-2.5 px-3 text-right">Total Gasto</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1E293B]">
            {customers && customers.length > 0 ? (
              customers.map((c, idx) => (
                <tr key={idx} className="hover:bg-[#1E293B]/30">
                  <td className="py-2.5 px-3 font-mono text-slate-300 truncate max-w-[150px]">{c.customerId}</td>
                  <td className="py-2.5 px-3">
                    <span className="px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-300 text-[10px] font-bold border border-indigo-500/20">
                      {c.segment}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-200">
                    {c.rfm_score || `${c.r_score}${c.f_score}${c.m_score}`}
                  </td>
                  <td className="py-2.5 px-3 text-right font-black text-emerald-400">
                    R$ {c.monetary.toFixed(2).replace('.', ',')}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="py-6 text-center text-slate-500">Sem dados de segmentação RFM.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RfmSegmentationTable;
