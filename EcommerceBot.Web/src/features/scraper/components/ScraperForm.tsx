/**
 * src/features/scraper/components/ScraperForm.tsx
 *
 * Formulário unificado de extração de produtos (URL Única e Ingestão em Lote) com streaming SSE.
 * Em conformidade com acessibilidade WCAG 2.1 AA, inputs >= 16px e touch targets >= 44px.
 * Modularizado em conformidade com o limite de 350 linhas do Quality Gate (max-lines).
 */

import React, { useState } from 'react';
import {
  Globe,
  Link2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RotateCcw,
  Square,
  Layers,
} from 'lucide-react';
import {
  Card,
  FormField,
  Button,
  type BadgeVariant,
} from '@/components/ui';
import { cn } from '@/lib/utils';
import { useScraper } from '../hooks/useScraper';
import { useScraperStream } from '../hooks/useScraperStream';
import type { ScraperFormProps } from '../types';
import { isValidHttpUrl } from '@/utils/security';
import { ScraperBatchForm } from './ScraperBatchForm';
import { ScraperStreamConsole } from './ScraperStreamConsole';

export const ScraperForm: React.FC<ScraperFormProps> = ({ className }) => {
  const { url, setUrl, isLoading, error: scraperError, submitUrl, reset: resetScraper } = useScraper();
  const { events, progress, isStreaming, error: streamError, lastEvent, connect, disconnect } = useScraperStream();

  const [mode, setMode] = useState<'single' | 'batch'>('single');

  const handleSubmitSingle = (e: React.FormEvent) => {
    e.preventDefault();

    // Trava de Segurança contra esquemas inválidos (ex: javascript: alert(1))
    if (!isValidHttpUrl(url)) {
      return;
    }

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
      {/* Selector de Modo: URL Única vs Ingestão em Lote */}
      <div
        role="tablist"
        aria-label="Modo de Ingestão do Scraper"
        className="flex gap-2 p-1.5 rounded-xl bg-slate-900 border border-slate-800"
      >
        <button
          type="button"
          role="tab"
          id="tab-scraper-single"
          aria-selected={mode === 'single'}
          aria-controls="panel-scraper-single"
          onClick={() => setMode('single')}
          className={cn(
            'flex-1 h-11 min-h-[44px] rounded-lg text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 cursor-pointer focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:outline-none',
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
          role="tab"
          id="tab-scraper-batch"
          aria-selected={mode === 'batch'}
          aria-controls="panel-scraper-batch"
          onClick={() => setMode('batch')}
          className={cn(
            'flex-1 h-11 min-h-[44px] rounded-lg text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 cursor-pointer focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:outline-none',
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
        <div
          role="tabpanel"
          id="panel-scraper-single"
          aria-labelledby="tab-scraper-single"
          className="animate-fade-in"
        >
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
                className="text-base min-h-[44px]"
                required
              />

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                {isStreaming ? (
                  <Button
                    type="button"
                    variant="danger"
                    size="md"
                    onClick={handleStop}
                    aria-label="Parar extração em andamento"
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
                    aria-label="Iniciar nova extração"
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
                  className="w-full sm:w-auto min-h-[44px] font-bold"
                >
                  {isLoading ? 'Enviando...' : 'Extrair Dados'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Terminal de Stream Log para URL Única */}
      {mode === 'single' && (events.length > 0 || isStreaming || error) && (
        <ScraperStreamConsole
          events={events}
          progress={progress}
          error={error}
          statusInfo={statusInfo}
        />
      )}

      {/* Form Modo 2: Ingestão em Lote */}
      {mode === 'batch' && <ScraperBatchForm />}
    </div>
  );
};

export default ScraperForm;
