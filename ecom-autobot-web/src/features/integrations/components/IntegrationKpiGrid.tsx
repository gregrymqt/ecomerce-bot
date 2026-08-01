/**
 * src/features/integrations/components/IntegrationKpiGrid.tsx
 *
 * Grid de KPIs e métricas consolidadas da Central de Integrações.
 * Exibe contagem de lojas, porcentagem operacional da API com indicador pulsante e última sincronização.
 */

import React from 'react';
import { Store, Activity, RefreshCw } from 'lucide-react';
import { cn } from '@/utils/cn';
import type { IntegrationSummary } from '../types/integration.type';

interface IntegrationKpiGridProps {
  summary: IntegrationSummary | null;
  loading?: boolean;
  className?: string;
}

export const IntegrationKpiGrid: React.FC<IntegrationKpiGridProps> = ({
  summary,
  loading = false,
  className,
}) => {
  const connectedCount = summary?.connected_stores_count ?? 1;
  const maxAllowed = summary?.max_stores_allowed ?? 3;
  const apiStatus = summary?.api_status_percentage ?? 100;
  const lastSync = summary?.last_sync_timestamp
    ? new Date(summary.last_sync_timestamp).toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'Há 5 minutos';

  return (
    <div className={cn('grid grid-cols-1 md:grid-cols-3 gap-4 text-slate-100', className)}>
      {/* Card 1: Lojas Conectadas */}
      <div className="rounded-2xl bg-[#15121B] border border-[#1E293B] p-5 shadow-lg flex items-center justify-between">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-1">
            Lojas Conectadas
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-white">
              {loading ? '...' : connectedCount}
            </span>
            <span className="text-xs text-slate-400 font-mono">/ {maxAllowed} permitidas</span>
          </div>
        </div>
        <div className="h-12 w-12 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400 shrink-0">
          <Store className="h-6 w-6" />
        </div>
      </div>

      {/* Card 2: Status da API (com indicador pulsante emerald) */}
      <div className="rounded-2xl bg-[#15121B] border border-[#1E293B] p-5 shadow-lg flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Status das APIs
            </span>
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl sm:text-3xl font-black text-emerald-400">
              {loading ? '...' : `${apiStatus}%`}
            </span>
            <span className="text-xs text-slate-300 font-semibold">Operacional</span>
          </div>
        </div>
        <div className="h-12 w-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
          <Activity className="h-6 w-6" />
        </div>
      </div>

      {/* Card 3: Última Sincronização */}
      <div className="rounded-2xl bg-[#15121B] border border-[#1E293B] p-5 shadow-lg flex items-center justify-between">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-1">
            Última Sincronização
          </span>
          <span className="text-2xl sm:text-3xl font-black text-white block">
            {loading ? '...' : lastSync}
          </span>
          <span className="text-[11px] text-slate-400">Auto-sync ativado via Webhooks</span>
        </div>
        <div className="h-12 w-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
          <RefreshCw className="h-6 w-6" />
        </div>
      </div>
    </div>
  );
};
