/**
 * src/features/dashboard/components/SystemHealthWidget.tsx
 *
 * Widget de Monitoramento da Saúde dos Microsserviços e Workers do Ecossistema.
 * Exibe status em tempo real (ScraperWorker, ProcessorWorker, RabbitMQ, Redis) com indicadores pulsantes.
 */

import React from 'react';
import { Server, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SystemHealthItem } from '../types';

export interface SystemHealthWidgetProps {
  healthItems?: SystemHealthItem[];
  className?: string;
}

export const SystemHealthWidget: React.FC<SystemHealthWidgetProps> = ({
  healthItems = [],
  className,
}) => {
  const items = healthItems ?? [];
  const allOnline = items.length > 0 && items.every((item) => item.status === 'ONLINE');
  const hasOffline = items.some((item) => item.status === 'OFFLINE');

  return (
    <div
      className={cn(
        'rounded-2xl bg-[#15121B] border border-[#1E293B] p-6 text-slate-100 shadow-xl space-y-4',
        className
      )}
    >
      {/* Cabeçalho do Widget */}
      <div className="flex items-center justify-between pb-4 border-b border-[#1E293B]">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
            <Server className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Saúde dos Microsserviços</h3>
            <p className="text-xs text-slate-400">Status da infraestrutura Core API & Workers</p>
          </div>
        </div>

        <span
          className={cn(
            'inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border',
            allOnline
              ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
              : hasOffline
                ? 'text-red-400 bg-red-500/10 border-red-500/20'
                : 'text-amber-400 bg-amber-500/10 border-amber-500/20'
          )}
        >
          <Activity className="h-3.5 w-3.5" />
          {items.length === 0
            ? 'Sem Leituras'
            : allOnline
              ? '100% Online'
              : hasOffline
                ? 'Serviço Offline'
                : 'Degradado'}
        </span>
      </div>

      {/* Lista de Serviços */}
      <div className="space-y-3">
        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#1E293B] bg-[#090D16]/40 p-5 text-center text-xs text-slate-400">
            Nenhuma leitura de saúde disponível no momento.
          </div>
        ) : (
          items.map((svc, idx) => (
          <div
            key={idx}
            className="rounded-xl bg-[#090D16] border border-[#1E293B] p-3 flex items-center justify-between text-xs sm:text-sm"
          >
            <div className="flex items-center gap-3">
              <span className="relative flex h-2.5 w-2.5 shrink-0">
                {svc.status === 'ONLINE' && (
                  <>
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                  </>
                )}
                {svc.status === 'DEGRADED' && (
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                )}
                {svc.status === 'OFFLINE' && (
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                )}
              </span>

              <div>
                <span className="font-semibold text-slate-200 block">{svc.service_name}</span>
                {svc.details && <span className="text-[11px] text-slate-400">{svc.details}</span>}
              </div>
            </div>

            <span
              className={cn(
                'font-mono text-xs font-bold uppercase',
                svc.status === 'ONLINE'
                  ? 'text-emerald-400'
                  : svc.status === 'OFFLINE'
                    ? 'text-red-400'
                    : 'text-amber-400'
              )}
            >
              {svc.status}
            </span>
          </div>
          ))
        )}
      </div>
    </div>
  );
};

export default SystemHealthWidget;
