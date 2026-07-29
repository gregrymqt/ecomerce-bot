import React, { useRef, useEffect, useState } from 'react';
import { Globe, Link2, Terminal, CheckCircle2, AlertCircle, Loader2, RotateCcw, Square, Layers, Sparkles } from 'lucide-react';
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
import { scrapperService } from '../services/scrapper.service';

interface BatchQueueItem {
  id: number;
  url: string;
  status: 'pending' | 'sending' | 'completed' | 'failed';
  error?: string;
}

export const ScraperForm: React.FC<ScraperFormProps> = ({ className }) => {
  const { url, setUrl, isLoading, error: scraperError, submitUrl, reset: resetScraper } = useScraper();
  const { events, progress, isStreaming, error: streamError, lastEvent, connect, disconnect } = useScraperStream();

  const [mode, setMode] = useState<'single' | 'batch'>('single');
  const [batchRawText, setBatchRawText] = useState<string>('');
  const [batchQueue, setBatchQueue] = useState<BatchQueueItem[]>([]);
  const [isBatchProcessing, setIsBatchProcessing] = useState<boolean>(false);
  const [batchProgress, setBatchProgress] = useState<number>(0);

  const terminalEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events]);

  const handleSubmitSingle = (e: React.FormEvent) => {
    e.preventDefault();
    submitUrl().then(() => {
      connect();
    });
  };

  const handleStartBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    const urls = batchRawText
      .split('\n')
      .map((u) => u.trim())
      .filter((u) => u.startsWith('http://') || u.startsWith('https://'));

    if (urls.length === 0) return;

    const initialQueue: BatchQueueItem[] = urls.map((u, idx) => ({
      id: idx,
      url: u,
      status: 'pending',
    }));

    setBatchQueue(initialQueue);
    setIsBatchProcessing(true);
    setBatchProgress(0);

    for (let i = 0; i < initialQueue.length; i++) {
      setBatchQueue((prev) =>
        prev.map((item, idx) => (idx === i ? { ...item, status: 'sending' } : item))
      );

      try {
        await scrapperService.extractUrl({ url: initialQueue[i].url });
        setBatchQueue((prev) =>
          prev.map((item, idx) => (idx === i ? { ...item, status: 'completed' } : item))
        );
      } catch (err: unknown) {
        setBatchQueue((prev) =>
          prev.map((item, idx) =>
            idx === i ? { ...item, status: 'failed', error: 'Falha no enfileiramento' } : item
          )
        );
      }

      const percent = Math.round(((i + 1) / initialQueue.length) * 100);
      setBatchProgress(percent);
    }

    setIsBatchProcessing(false);
  };

  const handleStop = () => {
    disconnect();
  };

  const handleReset = () => {
    disconnect();
    resetScraper();
    setBatchQueue([]);
    setBatchProgress(0);
    setIsBatchProcessing(false);
  };

  const error = scraperError || streamError;

  const getStatusInfo = (): { label: string; variant: BadgeVariant; icon?: React.ReactNode } => {
    if (error) {
      return { label: 'Erro', variant: 'error', icon: <AlertCircle className="w-3.5 h-3.5" /> };
    }
    if (lastEvent?.status === 'completed' || progress >= 100) {
      return { label: 'Concluído', variant: 'success', icon: <CheckCircle2 className="w-3.5 h-3.5" /> };
    }
    if (isStreaming || isBatchProcessing) {
      return { label: 'Processando...', variant: 'warning', icon: <Loader2 className="w-3.5 h-3.5 animate-spin" /> };
    }
    return { label: 'Aguardando', variant: 'default' };
  };

  const statusInfo = getStatusInfo();

  return (
    <div className={cn('flex flex-col gap-6', className)}>
      {/* Selector de Modo: URL Única vs Ingestão em Lote */}
      <div className="flex gap-2 p-1.5 rounded-xl bg-slate-900 border border-slate-800">
        <button
          type="button"
          onClick={() => setMode('single')}
          className={cn(
            'flex-1 h-11 min-h-[44px] rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer',
            mode === 'single'
              ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
              : 'text-slate-400 hover:text-white'
          )}
        >
          <Link2 className="w-4 h-4" />
          <span>URL Única</span>
        </button>

        <button
          type="button"
          onClick={() => setMode('batch')}
          className={cn(
            'flex-1 h-11 min-h-[44px] rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer',
            mode === 'batch'
              ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
              : 'text-slate-400 hover:text-white'
          )}
        >
          <Layers className="w-4 h-4" />
          <span>Ingestão em Lote (Múltiplas URLs)</span>
        </button>
      </div>

      {/* Form Modo 1: URL Única */}
      {mode === 'single' && (
        <Card>
          <form onSubmit={handleSubmitSingle} className="flex flex-col gap-5" noValidate>
            <div className="flex flex-col gap-1">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Link2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                Extração por URL Única
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Insira a URL de um produto de e-commerce para extrair e enriquecer dados automaticamente.
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
                disabled={isStreaming || !url.trim()}
                iconLeft={<Link2 className="w-4 h-4" />}
                className="w-full sm:w-auto h-11 min-h-[44px]"
              >
                {isLoading ? 'Enviando...' : 'Extrair Dados'}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Form Modo 2: Ingestão em Lote */}
      {mode === 'batch' && (
        <Card>
          <form onSubmit={handleStartBatch} className="flex flex-col gap-5" noValidate>
            <div className="flex flex-col gap-1">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-purple-600 dark:text-purple-400 shrink-0" />
                Ingestão em Lote de Produtos
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Cole uma URL por linha. Cada produto será enfileirado no RabbitMQ e processado por IA.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Lista de URLs (uma por linha)
              </label>
              <textarea
                rows={5}
                disabled={isBatchProcessing}
                value={batchRawText}
                onChange={(e) => setBatchRawText(e.target.value)}
                placeholder={'https://loja.com/produto-1\nhttps://loja.com/produto-2\nhttps://loja.com/produto-3'}
                className={cn(
                  'w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-base text-white placeholder:text-slate-500 font-mono',
                  'focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20'
                )}
              />
            </div>

            {/* Aviso e Indicador Visual de Carga Fila por Fila */}
            {isBatchProcessing && (
              <div className="flex items-center gap-3 p-3.5 rounded-xl border border-amber-500/30 bg-amber-950/30 text-amber-300">
                <Loader2 className="h-5 w-5 animate-spin shrink-0 text-amber-400" />
                <div className="text-xs">
                  <span className="font-bold">⚠️ Processando fila em lote...</span> Mantenha este painel aberto até o envio de todas as URLs ser concluído.
                </div>
              </div>
            )}

            {/* Progresso do Lote */}
            {batchQueue.length > 0 && (
              <div className="flex flex-col gap-3 p-4 rounded-xl border border-slate-800 bg-slate-950">
                <ProgressBar
                  value={batchProgress}
                  max={100}
                  showPercentage
                  label={`Fila de Envio: ${batchQueue.filter((i) => i.status === 'completed').length}/${batchQueue.length} enviadas`}
                  color={batchProgress >= 100 ? 'emerald' : 'indigo'}
                />

                <div className="max-h-40 overflow-y-auto space-y-1.5 font-mono text-xs text-slate-300 pt-2 border-t border-slate-800">
                  {batchQueue.map((item) => (
                    <div key={item.id} className="flex items-center justify-between gap-2 p-1.5 rounded bg-slate-900">
                      <span className="truncate flex-1 text-slate-400">{item.url}</span>
                      {item.status === 'pending' && <span className="text-slate-500 text-[10px]">Aguardando</span>}
                      {item.status === 'sending' && (
                        <span className="text-amber-400 text-[10px] flex items-center gap-1 font-bold">
                          <Loader2 className="h-3 w-3 animate-spin" /> Enviando...
                        </span>
                      )}
                      {item.status === 'completed' && (
                        <span className="text-emerald-400 text-[10px] flex items-center gap-1 font-bold">
                          <CheckCircle2 className="h-3 w-3" /> Enviado
                        </span>
                      )}
                      {item.status === 'failed' && (
                        <span className="text-rose-400 text-[10px] flex items-center gap-1 font-bold">
                          <AlertCircle className="h-3 w-3" /> Erro
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
              <Button
                type="submit"
                variant="primary"
                size="md"
                isLoading={isBatchProcessing}
                disabled={isBatchProcessing || !batchRawText.trim()}
                iconLeft={<Sparkles className="w-4 h-4" />}
                className="w-full sm:w-auto h-11 min-h-[44px] bg-purple-600 hover:bg-purple-500 text-white"
              >
                {isBatchProcessing ? 'Enfileirando Lote...' : 'Disparar Ingestão em Lote'}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Terminal de Stream Log para URL Única */}
      {mode === 'single' && (events.length > 0 || isStreaming || error) && (
        <Card>
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
              <Alert variant="error" title="Falha no Processamento">
                {error}
              </Alert>
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
