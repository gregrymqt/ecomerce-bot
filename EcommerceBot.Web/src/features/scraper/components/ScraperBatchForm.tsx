import React, { useState } from 'react';
import { Layers, Sparkles, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Card, Button, ProgressBar } from '@/components/ui';
import { cn } from '@/lib/utils';
import { scraperService } from '../services/scraper.service';
import type { BatchQueueItem } from '../types';
import { getErrorMessage } from '@/utils/errors';

export interface ScraperBatchFormProps {
  className?: string;
}

export const ScraperBatchForm: React.FC<ScraperBatchFormProps> = ({ className }) => {
  const [batchRawText, setBatchRawText] = useState<string>('');
  const [batchQueue, setBatchQueue] = useState<BatchQueueItem[]>([]);
  const [isBatchProcessing, setIsBatchProcessing] = useState<boolean>(false);
  const [batchProgress, setBatchProgress] = useState<number>(0);

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
        await scraperService.extractUrl({ url: initialQueue[i].url });
        setBatchQueue((prev) =>
          prev.map((item, idx) => (idx === i ? { ...item, status: 'completed' } : item))
        );
      } catch (err: unknown) {
        const errorMsg = getErrorMessage(err, 'Falha no enfileiramento');
        setBatchQueue((prev) =>
          prev.map((item, idx) =>
            idx === i ? { ...item, status: 'failed', error: errorMsg } : item
          )
        );
      }

      const percent = Math.round(((i + 1) / initialQueue.length) * 100);
      setBatchProgress(percent);
    }

    setIsBatchProcessing(false);
  };

  return (
    <div
      role="tabpanel"
      id="panel-scraper-batch"
      aria-labelledby="tab-scraper-batch"
      className={cn('animate-fade-in', className)}
    >
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
            <label
              htmlFor="batch-urls-input"
              className="text-sm font-semibold text-slate-700 dark:text-slate-300"
            >
              Lista de URLs (uma por linha)
            </label>
            <textarea
              id="batch-urls-input"
              rows={5}
              disabled={isBatchProcessing}
              value={batchRawText}
              onChange={(e) => setBatchRawText(e.target.value)}
              placeholder={'https://loja.com/produto-1\nhttps://loja.com/produto-2\nhttps://loja.com/produto-3'}
              className={cn(
                'w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-base text-white placeholder:text-slate-500 font-mono',
                'focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 min-h-[120px]'
              )}
            />
          </div>

          {isBatchProcessing && (
            <div
              role="status"
              className="flex items-center gap-3 p-3.5 rounded-xl border border-amber-500/30 bg-amber-950/30 text-amber-300"
            >
              <Loader2 className="h-5 w-5 animate-spin shrink-0 text-amber-400" />
              <div className="text-xs sm:text-sm">
                <span className="font-bold">Processando fila em lote...</span> Mantenha este painel aberto até o envio de todas as URLs ser concluído.
              </div>
            </div>
          )}

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
                  <div key={item.id} className="flex items-center justify-between gap-2 p-2 rounded bg-slate-900 min-h-[36px]">
                    <span className="truncate flex-1 text-slate-400">{item.url}</span>
                    {item.status === 'pending' && <span className="text-slate-500 text-xs">Aguardando</span>}
                    {item.status === 'sending' && (
                      <span className="text-amber-400 text-xs flex items-center gap-1 font-bold">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Enviando...
                      </span>
                    )}
                    {item.status === 'completed' && (
                      <span className="text-emerald-400 text-xs flex items-center gap-1 font-bold">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Enviado
                      </span>
                    )}
                    {item.status === 'failed' && (
                      <span className="text-rose-400 text-xs flex items-center gap-1 font-bold">
                        <AlertCircle className="h-3.5 w-3.5" /> Erro
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
              className="w-full sm:w-auto min-h-[44px] bg-purple-600 hover:bg-purple-500 font-bold text-white shadow-lg shadow-purple-600/25"
            >
              {isBatchProcessing ? 'Enfileirando Lote...' : 'Disparar Ingestão em Lote'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};
