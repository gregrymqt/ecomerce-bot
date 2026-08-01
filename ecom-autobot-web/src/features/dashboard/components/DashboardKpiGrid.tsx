/**
 * src/features/dashboard/components/DashboardKpiGrid.tsx
 *
 * Grid de KPIs do Dashboard Principal.
 * Exibe Total Extraído, Taxa de Sucesso, Economia de Tempo e Créditos Restantes com barra de progresso.
 */

import React from 'react';
import { Package, TrendingUp, CheckCircle, Clock, Zap } from 'lucide-react';
import { cn } from '@/utils/cn';
import type { DashboardKpiMetrics } from '../types/dashboard.type';

interface DashboardKpiGridProps {
  metrics?: DashboardKpiMetrics | null;
  loading?: boolean;
  className?: string;
}

export const DashboardKpiGrid: React.FC<DashboardKpiGridProps> = ({
  metrics,
  loading = false,
  className,
}) => {
  const totalExtracted = metrics?.total_extracted ?? 1284;
  const growth = metrics?.growth_percentage ?? 14.2;
  const successRate = metrics?.success_rate_percentage ?? 98.5;
  const hoursSaved = metrics?.estimated_hours_saved ?? 48;
  const creditsUsed = metrics?.credits_used ?? 8500;
  const creditsTotal = metrics?.credits_total ?? 10000;
  const creditPercent = Math.round((creditsUsed / (creditsTotal || 1)) * 100);

  return (
    <div className={cn('grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-slate-100', className)}>
      {/* Card 1: Total Extraído */}
      <div className="rounded-2xl bg-[#15121B] border border-[#1E293B] p-5 shadow-lg flex flex-col justify-between space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Total Extraído
          </span>
          <div className="h-10 w-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400 shrink-0">
            <Package className="h-5 w-5" />
          </div>
        </div>
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-white">
              {loading ? '...' : totalExtracted.toLocaleString('pt-BR')}
            </span>
            <span className="inline-flex items-center gap-0.5 text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
              <TrendingUp className="h-3 w-3" />
              +{growth}%
            </span>
          </div>
          <span className="text-xs text-slate-400 mt-1 block">Produtos ingeridos no período</span>
        </div>
      </div>

      {/* Card 2: Taxa de Sucesso */}
      <div className="rounded-2xl bg-[#15121B] border border-[#1E293B] p-5 shadow-lg flex flex-col justify-between space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Taxa de Sucesso
          </span>
          <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
            <CheckCircle className="h-5 w-5" />
          </div>
        </div>
        <div>
          <span className="text-2xl sm:text-3xl font-black text-emerald-400 block">
            {loading ? '...' : `${successRate}%`}
          </span>
          <span className="text-xs text-slate-400 mt-1 block">JSON-LD / Fallback LLM OK</span>
        </div>
      </div>

      {/* Card 3: Economia de Tempo */}
      <div className="rounded-2xl bg-[#15121B] border border-[#1E293B] p-5 shadow-lg flex flex-col justify-between space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Economia de Tempo
          </span>
          <div className="h-10 w-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
            <Clock className="h-5 w-5" />
          </div>
        </div>
        <div>
          <span className="text-2xl sm:text-3xl font-black text-white block">
            {loading ? '...' : `~${hoursSaved}h`}
          </span>
          <span className="text-xs text-slate-400 mt-1 block">Horas de trabalho manual salvas</span>
        </div>
      </div>

      {/* Card 4: Créditos Restantes (com Barra de Progresso) */}
      <div className="rounded-2xl bg-[#15121B] border border-[#1E293B] p-5 shadow-lg flex flex-col justify-between space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Créditos Restantes
          </span>
          <div className="h-10 w-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
            <Zap className="h-5 w-5" />
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <span className="text-xl sm:text-2xl font-black text-white">
              {loading ? '...' : creditsUsed.toLocaleString('pt-BR')}
            </span>
            <span className="text-xs font-mono text-slate-400">
              / {creditsTotal.toLocaleString('pt-BR')}
            </span>
          </div>
          <div className="w-full bg-[#090D16] rounded-full h-2 border border-[#1E293B] overflow-hidden">
            <div
              className="bg-gradient-to-r from-violet-500 to-indigo-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, creditPercent)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
