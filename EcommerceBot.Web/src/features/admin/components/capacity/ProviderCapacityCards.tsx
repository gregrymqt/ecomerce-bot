import React from 'react';
import { Cpu } from 'lucide-react';
import { Badge } from '@/components/ui/feedback/Badge';
import type { ProviderCapacityDetail } from '../../types/aiCapacity.types';
import { cn } from '@/lib/utils';

interface ProviderCapacityCardsProps {
  providers?: Record<string, ProviderCapacityDetail>;
}

export const ProviderCapacityCards: React.FC<ProviderCapacityCardsProps> = ({ providers = {} }) => {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-white">Status por Operadora de IA</h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Saldo individual, velocidade de queima e dias restantes em cada provedor.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Object.entries(providers).map(([providerName, p]) => (
          <div
            key={providerName}
            className="rounded-2xl bg-slate-900 border border-slate-800 p-5 space-y-4 shadow-lg"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cpu className="w-5 h-5 text-indigo-400" />
                <span className="font-black text-base text-white">{providerName}</span>
              </div>
              <Badge variant={p.isCritical ? 'error' : 'success'}>
                {p.isCritical ? 'Crítico (< 7d)' : 'Operacional'}
              </Badge>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-slate-300">
                <span className="text-slate-400">Saldo Atual:</span>
                <span className="font-bold text-white font-mono">
                  ${p.currentBalanceUsd.toFixed(2)} USD
                </span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span className="text-slate-400">Burn Rate Diário:</span>
                <span className="font-mono text-slate-200">
                  ${p.dailyBurnRateUsd.toFixed(4)} /dia
                </span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span className="text-slate-400">Autonomia:</span>
                <span
                  className={cn(
                    'font-bold',
                    p.isCritical ? 'text-rose-400' : 'text-emerald-400'
                  )}
                >
                  {p.runwayDays >= 900 ? 'Sem consumo' : `${p.runwayDays} dias`}
                </span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span className="text-slate-400">Recarga Sugerida:</span>
                <span className="font-bold text-indigo-300 font-mono">
                  ${p.recommendedTopupUsd.toFixed(2)} USD
                </span>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-between items-center text-[11px] text-slate-400">
              <span>Cenário Recomendado:</span>
              <span className="font-bold text-white">
                {p.scenarios.recommended.tokens.toLocaleString()} tokens
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProviderCapacityCards;
