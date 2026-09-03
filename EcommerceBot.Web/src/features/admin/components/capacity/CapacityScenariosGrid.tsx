import React from 'react';
import { Layers } from 'lucide-react';
import type { ConsolidatedCapacity } from '../../types/aiCapacity.types';

interface CapacityScenariosGridProps {
  days: number;
  consolidated?: ConsolidatedCapacity;
}

export const CapacityScenariosGrid: React.FC<CapacityScenariosGridProps> = ({
  days,
  consolidated,
}) => {
  const low = consolidated?.scenarios.low;
  const recommended = consolidated?.scenarios.recommended;
  const safety = consolidated?.scenarios.safety;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Layers className="w-5 h-5 text-indigo-400" />
          Recomendação de Compra de Tokens para os Próximos {days} Dias
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Cálculo estatístico com base no histórico de scraping, taxa de crescimento e margens de risco.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Cenário 1: Baixa (Mínimo Basal) */}
        <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-6 flex flex-col justify-between shadow-xl">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Cenário Baixa
              </span>
              <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-xs font-bold text-slate-300">
                Mínimo Basal
              </span>
            </div>
            <div className="text-3xl font-black text-white">
              {(low?.tokens ?? 0).toLocaleString()}
              <span className="text-xs text-slate-400 block font-normal mt-0.5">
                tokens necessários
              </span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              {low?.description}
            </p>
          </div>

          <div className="pt-4 border-t border-slate-800 mt-4 flex items-center justify-between">
            <span className="text-xs text-slate-400">Custo Estimado:</span>
            <span className="text-lg font-black text-white font-mono">
              ${(low?.estimatedCostUsd ?? 0).toFixed(2)} USD
            </span>
          </div>
        </div>

        {/* Cenário 2: Recomendada (Tendência Ideal) — Destaque */}
        <div className="rounded-2xl bg-gradient-to-b from-indigo-950/60 to-slate-900 border-2 border-indigo-500 p-6 flex flex-col justify-between shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 bg-indigo-600 text-white font-bold text-[10px] uppercase px-3 py-1 rounded-bl-xl tracking-wider">
            RECOMENDADO
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-300">
                Cenário Recomendado
              </span>
            </div>
            <div className="text-3xl font-black text-indigo-400">
              {(recommended?.tokens ?? 0).toLocaleString()}
              <span className="text-xs text-indigo-200/80 block font-normal mt-0.5">
                tokens necessários
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              {recommended?.description}
            </p>
          </div>

          <div className="pt-4 border-t border-indigo-500/30 mt-4 flex items-center justify-between">
            <span className="text-xs text-indigo-200 font-semibold">Custo Estimado:</span>
            <span className="text-xl font-black text-indigo-300 font-mono">
              ${(recommended?.estimatedCostUsd ?? 0).toFixed(2)} USD
            </span>
          </div>
        </div>

        {/* Cenário 3: Segurança (Buffer de Pico 95%) */}
        <div className="rounded-2xl bg-slate-900/90 border border-emerald-500/30 p-6 flex flex-col justify-between shadow-xl">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                Cenário Segurança
              </span>
              <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-bold text-emerald-300 border border-emerald-500/20">
                Buffer 95%
              </span>
            </div>
            <div className="text-3xl font-black text-emerald-400">
              {(safety?.tokens ?? 0).toLocaleString()}
              <span className="text-xs text-slate-400 block font-normal mt-0.5">
                tokens necessários
              </span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              {safety?.description}
            </p>
          </div>

          <div className="pt-4 border-t border-slate-800 mt-4 flex items-center justify-between">
            <span className="text-xs text-slate-400">Custo Estimado:</span>
            <span className="text-lg font-black text-emerald-300 font-mono">
              ${(safety?.estimatedCostUsd ?? 0).toFixed(2)} USD
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CapacityScenariosGrid;
