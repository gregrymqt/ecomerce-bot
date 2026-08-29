/**
 * src/features/integrations/components/IntegrationKpiGrid.tsx
 *
 * Grid de KPIs e métricas consolidadas da Central de Integrações.
 * Exibe contagem de lojas, porcentagem operacional da API com indicador pulsante e última sincronização.
 */

import React from 'react';
import { Store, Activity, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { IntegrationSummary } from '../types';

export interface IntegrationKpiGridProps {
  summary: IntegrationSummary | null;
  loading?: boolean;
  className?: string;
}

export const IntegrationKpiGrid: React.FC<IntegrationKpiGridProps> = ({
  summary,
  loading = false,
  className,
}) => {
  const connectedCount = summary?.connected_stores_count ?? 0;
  const maxAllowed = summary?.max_stores_allowed ?? 3;
  const apiStatus = summary?.api_status_percentage ?? 100;

  const formattedLastSync = summary?.last_sync_timestamp
    ? new Date(summary.last_sync_timestamp).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'Aguardando primeiro sync';

  const isHealthy = apiStatus >= 90;
  const isWarning = apiStatus >= 50 && apiStatus < 90;

  return (
    <div
      role="region"
      aria-label="Métricas Principais de Integrações"
      className={cn('grid grid-cols-1 md:grid-cols-3 gap-4 text-slate-100', className)}
    >
      {/* Card 1: Lojas Conectadas */}
      <div className="rounded-2xl bg-[#15121B] border border-[#1E293B] p-5 shadow-lg flex items-center justify-between hover:border-slate-700 transition-all">
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
        <div className="h-12 w-12 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400 shrink-0 shadow-inner">
          <Store className="h-6 w-6" />
        </div>
      </div>

      {/* Card 2: Status da API (com indicador pulsante dinâmico) */}
      <div className="rounded-2xl bg-[#15121B] border border-[#1E293B] p-5 shadow-lg flex items-center justify-between hover:border-slate-700 transition-all">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Saúde das Conexões
            </span>
            <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
              <span
                className={cn(
                  'animate-ping absolute inline-flex h-full w-full rounded-full opacity-75',
                  isHealthy ? 'bg-emerald-400' : isWarning ? 'bg-amber-400' : 'bg-red-400'
                )}
              />
              <span
                className={cn(
                  'relative inline-flex rounded-full h-2.5 w-2.5',
                  isHealthy ? 'bg-emerald-500' : isWarning ? 'bg-amber-500' : 'bg-red-500'
                )}
              />
            </span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span
              className={cn(
                'text-2xl sm:text-3xl font-black',
                isHealthy ? 'text-emerald-400' : isWarning ? 'text-amber-400' : 'text-red-400'
              )}
            >
              {loading ? '...' : `${apiStatus}%`}
            </span>
            <span className="text-xs text-slate-300 font-semibold">
              {connectedCount === 0 ? 'Pronto para Conectar' : isHealthy ? 'Operacional' : 'Instabilidade'}
            </span>
          </div>
        </div>
        <div
          className={cn(
            'h-12 w-12 rounded-xl border flex items-center justify-center shrink-0 shadow-inner',
            isHealthy
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
              : isWarning
              ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
              : 'bg-red-500/10 border-red-500/20 text-red-400'
          )}
        >
          <Activity className="h-6 w-6" />
        </div>
      </div>

      {/* Card 3: Última Sincronização */}
      <div className="rounded-2xl bg-[#15121B] border border-[#1E293B] p-5 shadow-lg flex items-center justify-between hover:border-slate-700 transition-all">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-1">
            Última Sincronização
          </span>
          <span className="text-xl sm:text-2xl font-black text-white block">
            {loading ? '...' : formattedLastSync}
          </span>
          <span className="text-[11px] text-slate-400">
            {connectedCount > 0 ? 'Sync contínuo via Webhooks' : 'Conecte uma loja para ativar'}
          </span>
        </div>
        <div className="h-12 w-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0 shadow-inner">
          <RefreshCw className="h-6 w-6" />
        </div>
      </div>
    </div>
  );
};

export default IntegrationKpiGrid;
