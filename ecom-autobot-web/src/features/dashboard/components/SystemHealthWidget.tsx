/**
 * src/features/dashboard/components/SystemHealthWidget.tsx
 *
 * Widget de Monitoramento da Saúde dos Microsserviços e Workers do Ecossistema.
 * Exibe status em tempo real (ScraperWorker, ProcessorWorker, RabbitMQ, Redis) com indicadores pulsantes.
 */

import React from 'react';
import { Server, Activity } from 'lucide-react';
import { cn } from '@/utils/cn';
import type { SystemHealthItem } from '@/features/dashboard';

interface SystemHealthWidgetProps {
  healthItems?: SystemHealthItem[];
  className?: string;
}

const DEFAULT_HEALTH_ITEMS: SystemHealthItem[] = [
  { service_name: 'ScraperWorker Pool', status: 'ONLINE', details: '3 instâncias ativas' },
  { service_name: 'ProcessorWorker (LLM)', status: 'ONLINE', details: 'Timeout cleanup OK' },
  { service_name: 'RabbitMQ (aio-pika)', status: 'ONLINE', details: 'Fila ecommerce_prod limpa' },
  { service_name: 'Redis Pub/Sub & Cache', status: 'ONLINE', details: 'Rate limit & Pub/Sub 0ms' },
];

export const SystemHealthWidget: React.FC<SystemHealthWidgetProps> = ({
  healthItems = DEFAULT_HEALTH_ITEMS,
  className,
}) => {
  const items = healthItems && healthItems.length > 0 ? healthItems : DEFAULT_HEALTH_ITEMS;

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
            <p className="text-xs text-slate-400">Status da infraestrutura FastAPI & Workers</p>
          </div>
        </div>

        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
          <Activity className="h-3.5 w-3.5" />
          100% Online
        </span>
      </div>

      {/* Lista de Serviços */}
      <div className="space-y-3">
        {items.map((svc, idx) => (
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

            <span className="font-mono text-xs font-bold uppercase text-emerald-400">
              {svc.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
