import React, { useRef, useEffect } from 'react';
import { Globe, Link2, Terminal, CheckCircle2, AlertCircle, Loader2, RotateCcw, Square } from 'lucide-react';
import { Card } from '@/components/ui/display/Card';
import { FormField } from '@/components/ui/form/FormField';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/feedback/ProgressBar';
import { Alert } from '@/components/ui/feedback/Alert';
import { Badge, type BadgeVariant } from '@/components/ui/feedback/Badge';
import { cn } from '@/lib/utils';
import { useScraper } from '../hooks/useScraper';
import { useScraperStream } from '../hooks/useScraperStream';
import type { ScraperFormProps } from '../types/scrapper.type';

export const ScraperForm: React.FC<ScraperFormProps> = ({ className }) => {
  const { url, setUrl, isLoading, error: scraperError, submitUrl, reset: resetScraper } = useScraper();
  const { events, progress, isStreaming, error: streamError, lastEvent, connect, disconnect } = useScraperStream();

  const terminalEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitUrl().then(() => {
      connect();
    });
  };

  const handleStop = () => {
    disconnect();
  };

  const handleReset = () => {
    disconnect();
    resetScraper();
  };

  const error = scraperError || streamError;

  const getStatusInfo = (): { label: string; variant: BadgeVariant; icon?: React.ReactNode } => {
    if (error) {
      return { label: 'Erro', variant: 'error', icon: <AlertCircle className="w-3.5 h-3.5" /> };
    }
    if (lastEvent?.status === 'completed' || progress >= 100) {
      return { label: 'Concluído', variant: 'success', icon: <CheckCircle2 className="w-3.5 h-3.5" /> };
    }
    if (isStreaming) {
      return { label: 'Processando...', variant: 'warning', icon: <Loader2 className="w-3.5 h-3.5 animate-spin" /> };
    }
    return { label: 'Aguardando', variant: 'default' };
  };

  const statusInfo = getStatusInfo();

  return (
    <div className={cn('flex flex-col gap-6', className)}>
      {/* Formulário de URL */}
      <Card>
        <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
          <div className="flex flex-col gap-1">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Link2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
              Extração por URL
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Insira a URL de um produto de e-commerce para extrair e enriquecer dados automaticamente via Web Scraping.
            </p>
          </div>

          <FormField
            label="URL do Produto"
            placeholder="https://exemplo.com.br/produto"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            error={scraperError ?? undefined}
            disabled={isLoading || isStreaming}
            iconLeft={<Globe className="w-4 h-4 text-slate-400" />}
            required
          />

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            {isStreaming ? (
              <Button
                type="button"
                variant="danger"
                size="md"
                onClick={handleStop}
                iconLeft={<Square className="w-4 h-4 fill-current" />}
                className="w-full sm:w-auto min-h-[44px]"
              >
                Parar Extração
              </Button>
            ) : lastEvent ? (
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={handleReset}
                iconLeft={<RotateCcw className="w-4 h-4" />}
                className="w-full sm:w-auto min-h-[44px]"
              >
                Nova Extração
              </Button>
            ) : (
              <div />
            )}

            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={isLoading}
              disabled={isStreaming}
              iconLeft={<Link2 className="w-4 h-4" />}
              className="w-full sm:w-auto h-11 min-h-[44px]"
            >
              {isLoading ? 'Enviando...' : 'Extrair Dados'}
            </Button>
          </div>
        </form>
      </Card>

      {/* Terminal de Stream */}
      {(events.length > 0 || isStreaming || error) && (
        <Card>
          <div className="flex flex-col gap-5">
            {/* Header */}
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

            {/* Error Alert */}
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
              label="Progresso da Extração"
              color={error ? 'rose' : progress >= 100 ? 'emerald' : 'indigo'}
            />

            {/* Terminal Log */}
            <div className="relative flex flex-col rounded-xl bg-slate-950 border border-slate-800 shadow-inner overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-800 text-xs text-slate-400 font-mono">
                <span className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                  <span className="ml-2 font-semibold text-slate-300">scraper-stream.log</span>
                </span>
                <span>{events.length} evento(s)</span>
              </div>

              <div className="p-4 font-mono text-xs text-slate-200 max-h-72 overflow-y-auto flex flex-col gap-1.5">
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
                          className={`flex-1 break-words ${
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
      )}
    </div>
  );
};
