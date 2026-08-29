/**
 * src/features/analytics/components/ml/ChurnPredictionTable.tsx
 *
 * Tabela de Previsão de Churn (Evasão) & Ações Recomendadas pela IA com geração de cupons.
 */

import React from 'react';
import { ShieldAlert, Gift, Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import type { ChurnPrediction, ChurnRiskLevel } from '../../types/ml.types';

interface ChurnPredictionTableProps {
  predictions?: ChurnPrediction[];
  copiedActionId: string | null;
  onCopyCoupon: (customerId: string, code: string) => void;
}

const getRiskBadge = (risk: ChurnRiskLevel) => {
  switch (risk) {
    case 'CRITICAL':
      return 'bg-red-500/10 text-red-400 border-red-500/20';
    case 'HIGH':
      return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    case 'MEDIUM':
      return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
    case 'LOW':
    default:
      return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
  }
};

export const ChurnPredictionTable: React.FC<ChurnPredictionTableProps> = ({
  predictions,
  copiedActionId,
  onCopyCoupon,
}) => {
  return (
    <div className="rounded-2xl bg-[#15121B] border border-[#1E293B] p-6 shadow-xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-amber-400" />
            <h2 className="text-lg font-bold text-white">Previsão de Churn & Recomendações de Retenção</h2>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Probabilidade de cancelamento/abandono calculada por IA com sugestão de ação instantânea para o lojista.
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-[#090D16] text-slate-400 uppercase tracking-wider font-semibold border-b border-[#1E293B]">
            <tr>
              <th className="py-3.5 px-4">Cliente</th>
              <th className="py-3.5 px-4">Nível de Risco</th>
              <th className="py-3.5 px-4 text-center">Probabilidade Churn</th>
              <th className="py-3.5 px-4 text-center">Última Compra</th>
              <th className="py-3.5 px-4">Ação Recomendada pela IA</th>
              <th className="py-3.5 px-4 text-right">Executar</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1E293B]">
            {predictions && predictions.length > 0 ? (
              predictions.map((p, idx) => {
                const isCopied = copiedActionId === p.customerId;
                return (
                  <tr key={idx} className="hover:bg-[#1E293B]/40 transition-colors">
                    <td className="py-3 px-4 font-mono font-medium text-slate-200">{p.customerId}</td>
                    <td className="py-3 px-4">
                      <span className={cn('px-2.5 py-1 rounded-full text-[11px] font-bold border', getRiskBadge(p.riskLevel))}>
                        {p.riskLevel}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-white">
                      {(p.churnProbability * 100).toFixed(1)}%
                    </td>
                    <td className="py-3 px-4 text-center text-slate-400">
                      {p.lastOrderDaysAgo} dias atrás
                    </td>
                    <td className="py-3 px-4 text-indigo-300 font-medium">
                      {p.actionRecommendation || 'Disparar e-mail de reengajamento com frete grátis'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => onCopyCoupon(p.customerId, 'VOLTA20')}
                        iconLeft={
                          isCopied ? (
                            <Check className="h-3.5 w-3.5 text-emerald-400" />
                          ) : (
                            <Gift className="h-3.5 w-3.5 text-amber-400" />
                          )
                        }
                        className={cn(
                          'min-h-[44px] px-3 bg-[#1E293B] hover:bg-slate-700 text-slate-200 text-xs font-semibold border-slate-700',
                          isCopied && 'border-emerald-500/40 bg-emerald-950/20'
                        )}
                      >
                        {isCopied ? 'Cupom Copiado!' : 'Gerar Cupom'}
                      </Button>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-500">
                  Nenhuma previsão de churn disponível. Clique em &ldquo;Executar Análise de IA Agora&rdquo; para processar a base.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ChurnPredictionTable;
