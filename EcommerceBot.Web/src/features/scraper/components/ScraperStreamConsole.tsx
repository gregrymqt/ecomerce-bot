import React, { useRef, useEffect } from 'react';
import { Terminal } from 'lucide-react';
import { Card, ProgressBar, Alert, Badge, type BadgeVariant } from '@/components/ui';
import { cn } from '@/lib/utils';
import type { ScraperStreamEvent } from '../types';

export interface ScraperStreamConsoleProps {
  events: ScraperStreamEvent[];
  progress: number;
  error?: string | null;
  statusInfo: {
    label: string;
    variant: BadgeVariant;
    icon?: React.ReactNode;
  };
  className?: string;
}

export const ScraperStreamConsole: React.FC<ScraperStreamConsoleProps> = ({
  events,
  progress,
  error,
  statusInfo,
  className,
}) => {
  const terminalEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events]);

  return (
    <Card className={cn(className)}>
      <div className="flex flex-col gap-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Console de Extração
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Acompanhe o progresso do scraping em tempo real.
              </p>
            </div>
          </div>

          <div className="self-start sm:self-center">
            <Badge variant={statusInfo.variant} dot icon={statusInfo.icon}>
              {statusInfo.label}
            </Badge>
          </div>
        </div>

        {error && (
          <div className="animate-fade-in">
            <Alert variant="error" title="Falha no Processamento">
              {error}
            </Alert>
          </div>
        )}

        <ProgressBar
          value={progress}
          max={100}
          showPercentage
          label="Progresso da Extração"
          color={error ? 'rose' : progress >= 100 ? 'emerald' : 'indigo'}
        />

        <div className="relative flex flex-col rounded-xl bg-slate-950 border border-slate-800 shadow-inner overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-800 text-xs text-slate-400 font-mono">
            <span className="flex items-center gap-2" aria-hidden="true">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
              <span className="ml-2 font-semibold text-slate-300">scraper-stream.log</span>
            </span>
            <span>{events.length} evento(s)</span>
          </div>

          <div
            role="log"
            aria-live="polite"
            className="p-4 font-mono text-xs text-slate-200 max-h-72 overflow-y-auto flex flex-col gap-1.5"
          >
            {events.length === 0 ? (
              <div className="text-slate-500 italic py-4 text-center">
                Aguardando eventos de extração...
              </div>
            ) : (
              events.map((evt, index) => {
                const isErr = evt.status === 'failed';
                const isSuccess = evt.status === 'completed';

                return (
                  <div
                    key={index}
                    className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-2 leading-relaxed"
                  >
                    <span className="text-slate-500 shrink-0 select-none">
                      [{String(index + 1).padStart(2, '0')}]
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider shrink-0 uppercase ${
                        isErr
                          ? 'bg-rose-950 text-rose-300 border border-rose-800'
                          : isSuccess
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            : 'bg-indigo-950 text-indigo-300 border border-indigo-800'
                      }`}
                    >
                      {evt.status}
                    </span>
                    <span
                      className={`flex-1 wrap-break-word ${
                        isErr
                          ? 'text-rose-400'
                          : isSuccess
                            ? 'text-emerald-400'
                            : 'text-slate-200'
                      }`}
                    >
                      {evt.url || evt.error || `Progresso: ${evt.progress}%`}
                    </span>
                    <span className="text-slate-500 shrink-0 font-semibold text-[11px]">
                      {evt.progress}%
                    </span>
                  </div>
                );
              })
            )}
            <div ref={terminalEndRef} />
          </div>
        </div>
      </div>
    </Card>
  );
};
