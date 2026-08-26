/**
 * src/features/dashboard/components/VolumePerformanceChart.tsx
 *
 * Gráfico de Barras pareadas do Volume de Ingestão e Processamento por IA.
 * Inclui alternador de período (Dia, Semana, Mês) e brilho neon nas barras.
 */

import React from 'react';
import { BarChart2, Calendar } from 'lucide-react';
import { cn } from '@/utils/cn';
import type { PeriodFilter, VolumeChartItem } from '@/features/dashboard';

interface VolumePerformanceChartProps {
  items?: VolumeChartItem[];
  period: PeriodFilter;
  onPeriodChange: (period: PeriodFilter) => void;
  loading?: boolean;
  className?: string;
}

const DEFAULT_CHART_DATA: VolumeChartItem[] = [
  { label: 'Seg', raw_count: 140, processed_count: 135 },
  { label: 'Ter', raw_count: 210, processed_count: 205 },
  { label: 'Qua', raw_count: 180, processed_count: 178 },
  { label: 'Qui', raw_count: 260, processed_count: 254 },
  { label: 'Sex', raw_count: 310, processed_count: 300 },
  { label: 'Sáb', raw_count: 150, processed_count: 148 },
  { label: 'Dom', raw_count: 90, processed_count: 88 },
];

export const VolumePerformanceChart: React.FC<VolumePerformanceChartProps> = ({
  items = DEFAULT_CHART_DATA,
  period,
  onPeriodChange,
  loading = false,
  className,
}) => {
  const chartData = items && items.length > 0 ? items : DEFAULT_CHART_DATA;
  const maxVal = Math.max(...chartData.map((d) => Math.max(d.raw_count, d.processed_count)), 350);

  return (
    <div
      className={cn(
        'rounded-2xl bg-[#15121B] border border-[#1E293B] p-6 text-slate-100 shadow-xl space-y-6 flex flex-col justify-between',
        className
      )}
    >
      {/* Cabeçalho do Gráfico com Seletor de Período */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#1E293B]">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400 shrink-0">
            <BarChart2 className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Volume de Ingestão & Processamento</h3>
            <p className="text-xs text-slate-400">Comparativo RAW (Extração) vs PROCESSED (Enriquecido via IA)</p>
          </div>
        </div>

        {/* Pills de Período (min-h-[44px]) */}
        <div className="inline-flex items-center rounded-xl bg-[#090D16] p-1 border border-[#1E293B]">
          {(['DAY', 'WEEK', 'MONTH'] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onPeriodChange(p)}
              className={cn(
                'min-h-[44px] h-11 px-4 rounded-lg text-xs font-bold transition-all cursor-pointer font-mono',
                period === p
                  ? 'bg-violet-600 text-white shadow-md shadow-violet-600/20'
                  : 'text-slate-400 hover:text-white'
              )}
            >
              {p === 'DAY' ? 'Dia' : p === 'WEEK' ? 'Semana' : 'Mês'}
            </button>
          ))}
        </div>
      </div>

      {/* Área das Barras Pareadas */}
      <div className="h-64 pt-4 flex items-end justify-between gap-2 sm:gap-6 px-2">
        {chartData.map((item, idx) => {
          const rawHeightPercent = Math.round((item.raw_count / maxVal) * 100);
          const processedHeightPercent = Math.round((item.processed_count / maxVal) * 100);

          return (
            <div key={idx} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
              <div className="w-full flex items-end justify-center gap-1 sm:gap-2 h-full">
                {/* Barra RAW (Bruto) */}
                <div
                  className="w-3 sm:w-5 bg-indigo-600/70 hover:bg-indigo-500 rounded-t-md transition-all duration-300 relative"
                  style={{ height: loading ? '10%' : `${rawHeightPercent}%` }}
                >
                  <span className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-7 left-1/2 -translate-x-1/2 bg-[#090D16] text-slate-200 text-[10px] font-mono px-1.5 py-0.5 rounded border border-[#1E293B] pointer-events-none z-10">
                    {item.raw_count}
                  </span>
                </div>

                {/* Barra PROCESSED (IA Neon) */}
                <div
                  className="w-3 sm:w-5 bg-violet-500 shadow-[0_0_12px_rgba(139,92,246,0.6)] hover:bg-violet-400 rounded-t-md transition-all duration-300 relative"
                  style={{ height: loading ? '10%' : `${processedHeightPercent}%` }}
                >
                  <span className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-7 left-1/2 -translate-x-1/2 bg-[#090D16] text-emerald-400 text-[10px] font-mono px-1.5 py-0.5 rounded border border-[#1E293B] pointer-events-none z-10">
                    {item.processed_count}
                  </span>
                </div>
              </div>

              <span className="text-[11px] font-mono text-slate-400 group-hover:text-white transition-colors">
                {item.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Legenda do Gráfico */}
      <div className="pt-4 border-t border-[#1E293B] flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded bg-indigo-600/80 inline-block" />
            <span>RAW (Bruto Extraído)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded bg-violet-500 shadow-[0_0_8px_rgba(139,92,246,0.8)] inline-block" />
            <span>PROCESSED (Enriquecido por IA)</span>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-1 text-[11px]">
          <Calendar className="h-3.5 w-3.5 text-violet-400" />
          <span>Filtro de período ativo</span>
        </div>
      </div>
    </div>
  );
};
