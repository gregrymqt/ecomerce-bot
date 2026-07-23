import React, { useRef, useEffect } from 'react';
import { Terminal, Square, RotateCcw, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/display/Card';
import { ProgressBar } from '@/components/ui/feedback/ProgressBar';
import { Badge, type BadgeVariant } from '@/components/ui/feedback/Badge';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/feedback/Alert';
import type { DemoStreamViewerProps } from '..';

export const DemoStreamViewer: React.FC<DemoStreamViewerProps> = ({
  logs,
  progress,
  isStreaming,
  error,
  onStop,
  onReset,
  className,
}) => {
  const terminalEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const getStatusInfo = (): { label: string; variant: BadgeVariant; icon?: React.ReactNode } => {
    if (error) {
      return { label: 'Erro no Processamento', variant: 'error', icon: <AlertCircle className="w-3.5 h-3.5" /> };
    }
    const lastStep = logs[logs.length - 1]?.step;
    if (lastStep === 'FINISHED' || lastStep === 'COMPLETED' || progress >= 100) {
      return { label: 'Concluído', variant: 'success', icon: <CheckCircle2 className="w-3.5 h-3.5" /> };
    }
    if (isStreaming) {
      return { label: 'Processando...', variant: 'warning', icon: <Loader2 className="w-3.5 h-3.5 animate-spin" /> };
    }
    return { label: 'Pausado / Finalizado', variant: 'default' };
  };

  const statusInfo = getStatusInfo();

  return (
    <Card className={className}>
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Console de Transmissão
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Acompanhe o processamento de scraping e enriquecimento em tempo real.
              </p>
            </div>
          </div>

          <div className="self-start sm:self-center">
            <Badge variant={statusInfo.variant} dot icon={statusInfo.icon}>
              {statusInfo.label}
            </Badge>
          </div>
        </div>

        {/* Error Alert se houver erro ativo */}
        {error && (
          <Alert variant="error" title="Falha no Processamento">
            {error}
          </Alert>
        )}

        {/* Progress Bar */}
        <ProgressBar
          value={progress}
          max={100}
          showPercentage
          label="Progresso da Operação"
          color={error ? 'rose' : progress >= 100 ? 'emerald' : 'indigo'}
        />

        {/* Terminal Log Feed */}
        <div className="relative flex flex-col rounded-xl bg-slate-950 border border-slate-800 shadow-inner overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-800 text-xs text-slate-400 font-mono">
            <span className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
              <span className="ml-2 font-semibold text-slate-300">live-stream.log</span>
            </span>
            <span>{logs.length} evento(s)</span>
          </div>

          <div className="p-4 font-mono text-xs text-slate-200 max-h-72 overflow-y-auto flex flex-col gap-1.5 scrollbar-thin scrollbar-thumb-slate-800">
            {logs.length === 0 ? (
              <div className="text-slate-500 italic py-4 text-center">
                Aguardando recepção de eventos...
              </div>
            ) : (
              logs.map((log, index) => {
                const isErr = log.step === 'ERROR' || log.step?.includes('FAIL');
                const isSuccess = log.step === 'FINISHED' || log.step === 'COMPLETED';

                return (
                  <div
                    key={index}
                    className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-2 leading-relaxed"
                  >
                    <span className="text-slate-500 shrink-0 select-none">
                      [{String(index + 1).padStart(2, '0')}]
                    </span>
                    {log.step && (
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider shrink-0 uppercase ${
                          isErr
                            ? 'bg-rose-950 text-rose-300 border border-rose-800'
                            : isSuccess
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            : 'bg-indigo-950 text-indigo-300 border border-indigo-800'
                        }`}
                      >
                        {log.step}
                      </span>
                    )}
                    <span
                      className={`flex-1 break-words ${
                        isErr
                          ? 'text-rose-400'
                          : isSuccess
                          ? 'text-emerald-400'
                          : 'text-slate-200'
                      }`}
                    >
                      {log.message}
                    </span>
                    {typeof log.progress === 'number' && (
                      <span className="text-slate-500 shrink-0 font-semibold text-[11px]">
                        {log.progress}%
                      </span>
                    )}
                  </div>
                );
              })
            )}
            <div ref={terminalEndRef} />
          </div>
        </div>

        {/* Control Actions */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          {isStreaming ? (
            <Button
              type="button"
              variant="danger"
              size="md"
              onClick={onStop}
              iconLeft={<Square className="w-4 h-4 fill-current" />}
              className="min-h-[44px]"
            >
              Parar Demonstração
            </Button>
          ) : (
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={onReset}
              iconLeft={<RotateCcw className="w-4 h-4" />}
              className="min-h-[44px]"
            >
              Nova Demonstração
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
};
