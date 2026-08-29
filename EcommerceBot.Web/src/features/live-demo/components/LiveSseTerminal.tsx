/**
 * src/features/live-demo/components/LiveSseTerminal.tsx
 *
 * Terminal retroiluminado com transmissão ao vivo dos logs de processamento via SSE.
 * Em conformidade com acessibilidade WCAG 2.1 AA e badges com alto contraste.
 */

import React from 'react';
import { Terminal, Cpu, CheckCircle2, AlertTriangle, Radio } from 'lucide-react';
import { Badge, ProgressBar } from '@/components/ui';
import type { ConnectionStatus, DemoLogEvent, LogLevel } from '../types';
import { useLiveSseTerminal } from '../hooks/useLiveSseTerminal';
import { cn } from '@/lib/utils';

export interface LiveSseTerminalProps {
  status: ConnectionStatus;
  logs: DemoLogEvent[];
  progress: number;
  className?: string;
}

const LEVEL_STYLE: Record<LogLevel, { badge: string; text: string }> = {
  LISTEN: {
    badge: 'bg-sky-950/60 text-sky-400 border-sky-500/30',
    text: 'text-sky-300',
  },
  INFO: {
    badge: 'bg-slate-800/60 text-slate-300 border-slate-700',
    text: 'text-slate-200',
  },
  SCRAPER: {
    badge: 'bg-amber-950/60 text-amber-400 border-amber-500/30',
    text: 'text-amber-300',
  },
  AI_PROCESS: {
    badge: 'bg-purple-950/60 text-purple-400 border-purple-500/30',
    text: 'text-purple-300',
  },
  SUCCESS: {
    badge: 'bg-emerald-950/60 text-emerald-400 border-emerald-500/30',
    text: 'text-emerald-300',
  },
  ERROR: {
    badge: 'bg-rose-950/60 text-rose-400 border-rose-500/30',
    text: 'text-rose-300',
  },
};

export const LiveSseTerminal: React.FC<LiveSseTerminalProps> = ({
  status,
  logs,
  progress,
  className,
}) => {
  const { terminalEndRef } = useLiveSseTerminal(logs);

  const renderStatusBadge = () => {
    switch (status) {
      case 'connecting':
        return (
          <Badge variant="warning" dot icon={<Radio className="w-3.5 h-3.5" />}>
            CONECTANDO SSE...
          </Badge>
        );
      case 'connected':
        return (
          <Badge variant="success" dot>
            CONECTADO 200 OK
          </Badge>
        );
      case 'simulating':
        return (
          <Badge variant="purple" icon={<Cpu className="w-3.5 h-3.5 animate-spin" />}>
            SIMULANDO SSE
          </Badge>
        );
      case 'completed':
        return (
          <Badge variant="success" icon={<CheckCircle2 className="w-3.5 h-3.5" />}>
            CONCLUÍDO
          </Badge>
        );
      case 'error':
        return (
          <Badge variant="error" icon={<AlertTriangle className="w-3.5 h-3.5" />}>
            ERRO SSE
          </Badge>
        );
      default:
        return (
          <Badge variant="default">
            AGUARDANDO
          </Badge>
        );
    }
  };

  return (
    <div
      role="region"
      aria-label="Terminal de Transmissão SSE em Tempo Real"
      className={cn(
        'w-full rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 shadow-2xl flex flex-col',
        className
      )}
    >
      {/* Header do Terminal */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-900/90 border-b border-slate-800 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5" aria-hidden="true">
            <span className="w-3 h-3 rounded-full bg-rose-500/80" />
            <span className="w-3 h-3 rounded-full bg-amber-500/80" />
            <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
          </div>
          <div className="flex items-center gap-2 text-xs font-mono text-slate-400 pl-2 border-l border-slate-800">
            <Terminal className="w-4 h-4 text-purple-400" />
            <span>ecom-bot-worker@pubsub:~ stream</span>
          </div>
        </div>

        {renderStatusBadge()}
      </div>

      {/* Feed de Logs */}
      <div
        role="log"
        aria-live="polite"
        className="p-4 font-mono text-xs overflow-y-auto max-h-[320px] min-h-[220px] space-y-2.5 scrollbar-thin scrollbar-thumb-purple-900 scrollbar-track-slate-950"
      >
        {logs.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-600 gap-2 py-12">
            <Terminal className="w-8 h-8 text-slate-700 animate-pulse" />
            <p className="text-center font-sans text-xs text-slate-400">
              Aguardando início da demonstração... Cole uma URL acima e clique em "Iniciar".
            </p>
          </div>
        ) : (
          logs.map((log) => {
            const style = LEVEL_STYLE[log.level] || LEVEL_STYLE.INFO;
            return (
              <div
                key={log.id}
                className="flex items-start gap-2.5 leading-relaxed hover:bg-slate-900/50 p-1 rounded transition-colors"
              >
                <span className="text-slate-500 shrink-0 select-none font-mono">
                  [{log.timestamp}]
                </span>
                <span
                  className={cn(
                    'px-1.5 py-0.5 rounded text-[10px] font-semibold border shrink-0 uppercase tracking-wider font-mono',
                    style.badge
                  )}
                >
                  {log.level}
                </span>
                <span className={cn('break-all font-mono', style.text)}>{log.message}</span>
              </div>
            );
          })
        )}
        <div ref={terminalEndRef} />
      </div>

      {/* Barra de Progresso Inferior */}
      <div className="relative w-full bg-slate-900 px-4 py-3 border-t border-slate-800 flex items-center gap-3">
        <div className="flex-1">
          <ProgressBar value={progress} color="indigo" showPercentage={false} />
        </div>
        <span className="text-xs font-mono font-semibold text-purple-300 w-12 text-right shrink-0">
          {progress}%
        </span>
      </div>
    </div>
  );
};

export default LiveSseTerminal;
