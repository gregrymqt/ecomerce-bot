import React from 'react';
import { Cpu, RefreshCw, Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

interface CapacityHeaderProps {
  days: number;
  onSelectDays: (days: number) => void;
  onRecalculate: () => void;
  onOpenTopupModal: () => void;
  triggering: boolean;
}

export const CapacityHeader: React.FC<CapacityHeaderProps> = ({
  days,
  onSelectDays,
  onRecalculate,
  onOpenTopupModal,
  triggering,
}) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">
            SaaS AI FinOps
          </span>
          <span className="rounded-full bg-indigo-500/10 px-2 py-0.5 text-[10px] font-bold text-indigo-300 border border-indigo-500/20">
            PREVISÃO DE TOKENS
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-white flex items-center gap-2.5">
          <Cpu className="w-8 h-8 text-indigo-400" />
          Capacidade de IA & FinOps
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Previsão preditiva para aquisição de créditos em DeepSeek, Gemini e OpenRouter.
        </p>
      </div>

      {/* Ações e Filtro de Horizonte */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Seletor de Dias com Touch Targets >= 44px */}
        <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-1 text-xs">
          {[15, 30, 60, 90].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => onSelectDays(d)}
              className={cn(
                'px-3 py-2 rounded-lg font-bold transition-all min-h-[44px] cursor-pointer focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none',
                days === d
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              )}
            >
              {d} dias
            </button>
          ))}
        </div>

        <Button
          type="button"
          variant="outline"
          size="md"
          onClick={onRecalculate}
          isLoading={triggering}
          iconLeft={<RefreshCw className={cn('w-4 h-4', triggering && 'animate-spin')} />}
          className="min-h-[44px] border-slate-700 bg-slate-900 text-xs font-bold text-slate-200 cursor-pointer"
        >
          Recalcular
        </Button>

        <Button
          type="button"
          variant="primary"
          size="md"
          onClick={onOpenTopupModal}
          iconLeft={<Plus className="w-4 h-4" />}
          className="min-h-[44px] bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white shadow-lg shadow-indigo-600/20 cursor-pointer"
        >
          Registrar Recarga
        </Button>
      </div>
    </div>
  );
};

export default CapacityHeader;
