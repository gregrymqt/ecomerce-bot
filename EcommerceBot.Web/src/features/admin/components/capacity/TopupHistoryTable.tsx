import React from 'react';
import type { AiProviderCredit } from '../../types/aiCapacity.types';
import { cn } from '@/lib/utils';

interface TopupHistoryTableProps {
  topups?: AiProviderCredit[];
}

export const TopupHistoryTable: React.FC<TopupHistoryTableProps> = ({ topups = [] }) => {
  return (
    <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-4 shadow-xl">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div>
          <h3 className="text-base font-bold text-white">Histórico de Recargas das Operadoras</h3>
          <p className="text-xs text-slate-400">Entradas via Webhook automático ou registro manual</p>
        </div>
        <span className="text-xs font-mono text-slate-400">
          {topups.length} recargas registradas
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs sm:text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase text-[11px]">
              <th className="py-3 px-2">Data</th>
              <th className="py-3 px-2">Operadora</th>
              <th className="py-3 px-2">Valor Pago</th>
              <th className="py-3 px-2">Tokens Creditados</th>
              <th className="py-3 px-2">Saldo Resultante</th>
              <th className="py-3 px-2">Origem</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono">
            {topups.map((topup) => (
              <tr key={topup.id} className="hover:bg-slate-800/30 transition-colors">
                <td className="py-3 px-2 text-slate-400 text-xs">
                  {new Date(topup.createdAt).toLocaleDateString('pt-BR')}{' '}
                  {new Date(topup.createdAt).toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </td>
                <td className="py-3 px-2 font-bold text-white">{topup.provider}</td>
                <td className="py-3 px-2 text-emerald-400 font-bold">
                  ${topup.amountPaid.toFixed(2)} USD
                </td>
                <td className="py-3 px-2 text-slate-300">
                  {topup.tokensCredited > 0 ? topup.tokensCredited.toLocaleString() : 'N/A'}
                </td>
                <td className="py-3 px-2 text-indigo-300 font-bold">
                  ${topup.balanceRemaining.toFixed(2)} USD
                </td>
                <td className="py-3 px-2">
                  <span
                    className={cn(
                      'px-2 py-0.5 rounded text-[10px] font-bold uppercase',
                      topup.source === 'WEBHOOK'
                        ? 'bg-purple-950 text-purple-300 border border-purple-800'
                        : 'bg-indigo-950 text-indigo-300 border border-indigo-800'
                    )}
                  >
                    {topup.source}
                  </span>
                </td>
              </tr>
            ))}
            {topups.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-500 font-sans italic">
                  Nenhuma recarga registrada ainda. Utilize o botão "Registrar Recarga" acima para adicionar a primeira.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TopupHistoryTable;
