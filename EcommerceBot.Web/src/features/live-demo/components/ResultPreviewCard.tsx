/**
 * src/features/live-demo/components/ResultPreviewCard.tsx
 *
 * Exibição do produto enriquecido por IA com abas de Preview Visual e JSON Bruto.
 * Em conformidade com acessibilidade WCAG 2.1 AA, touch targets >= 44px e ARIA tablist.
 */

import React from 'react';
import { Eye, Code, Sparkles, CheckCircle2, Copy, Check, Tag, Award } from 'lucide-react';
import { Card, Badge, Button } from '@/components/ui';
import type { ScrapedProductResult } from '../types';
import { useResultPreviewCard } from '../hooks/useResultPreviewCard';
import { cn } from '@/lib/utils';

export interface ResultPreviewCardProps {
  result: ScrapedProductResult | null;
  className?: string;
}

export const ResultPreviewCard: React.FC<ResultPreviewCardProps> = ({
  result,
  className,
}) => {
  const { activeTab, setActiveTab, copied, handleCopyJson } = useResultPreviewCard(result);

  if (!result) return null;

  return (
    <Card
      className={cn(
        'w-full bg-slate-900/90 border-purple-500/30 shadow-2xl backdrop-blur-md flex flex-col p-0 overflow-hidden',
        className
      )}
    >
      {/* Header com Abas */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-4 bg-slate-950/80 border-b border-slate-800 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-400" />
          <h3 className="text-base font-bold text-white">Resultado Enriquecido por IA</h3>
        </div>

        <div
          role="tablist"
          aria-label="Opções de visualização do resultado"
          className="flex items-center gap-1 p-1 bg-slate-900 rounded-xl border border-slate-800"
        >
          <button
            type="button"
            role="tab"
            id="tab-visual-preview"
            aria-selected={activeTab === 'visual'}
            aria-controls="panel-visual-preview"
            onClick={() => setActiveTab('visual')}
            className={cn(
              'min-h-[44px] px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all flex items-center gap-1.5 font-mono cursor-pointer focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:outline-none',
              activeTab === 'visual'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            )}
          >
            <Eye className="w-4 h-4" />
            <span>Preview Visual</span>
          </button>

          <button
            type="button"
            role="tab"
            id="tab-json-raw"
            aria-selected={activeTab === 'json'}
            aria-controls="panel-json-raw"
            onClick={() => setActiveTab('json')}
            className={cn(
              'min-h-[44px] px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all flex items-center gap-1.5 font-mono cursor-pointer focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:outline-none',
              activeTab === 'json'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            )}
          >
            <Code className="w-4 h-4" />
            <span>JSON Bruto</span>
          </button>
        </div>
      </div>

      {/* Conteúdo Aba Preview Visual */}
      {activeTab === 'visual' && (
        <div
          role="tabpanel"
          id="panel-visual-preview"
          aria-labelledby="tab-visual-preview"
          className="p-6 grid grid-cols-1 md:grid-cols-12 gap-6 items-start animate-fade-in"
        >
          {/* Imagem do Produto */}
          <div className="md:col-span-5 relative group rounded-2xl overflow-hidden border border-slate-800 bg-slate-950">
            <img
              src={result.imageUrl}
              alt={result.titleMagnetic}
              className="w-full h-64 object-cover object-center group-hover:scale-105 transition-transform duration-500"
            />
            <div className="absolute top-3 left-3">
              <Badge variant="purple" dot icon={<Sparkles className="w-3.5 h-3.5 text-yellow-300" />}>
                AI ENHANCED
              </Badge>
            </div>
            <div className="absolute bottom-3 right-3">
              <Badge variant="success">
                {result.price}
              </Badge>
            </div>
          </div>

          {/* Informações Enriquecidas */}
          <div className="md:col-span-7 flex flex-col gap-4">
            {/* Título Original vs Título Magnético */}
            <div className="space-y-1">
              <span className="text-xs text-slate-500 font-mono line-through block">
                Original: {result.titleOriginal}
              </span>
              <h2 className="text-xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white via-purple-100 to-purple-400 leading-tight">
                {result.titleMagnetic}
              </h2>
            </div>

            {/* Badges de SEO, Categoria e Tom */}
            <div className="flex flex-wrap items-center gap-2 pt-1 font-mono">
              <Badge variant="purple" icon={<Tag className="w-3.5 h-3.5 text-purple-400" />}>
                {result.category}
              </Badge>
              <Badge variant="info">
                Tom: {result.tone}
              </Badge>
              <Badge variant="success" icon={<Award className="w-3.5 h-3.5" />}>
                SEO Score: {result.seoScore}/100
              </Badge>
            </div>

            {/* Bullet Points */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">
                Benefícios de Alta Conversão:
              </h4>
              <ul className="space-y-2">
                {result.bulletPoints.map((bullet, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-xs sm:text-sm text-slate-300 leading-relaxed">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Conteúdo Aba JSON Bruto */}
      {activeTab === 'json' && (
        <div
          role="tabpanel"
          id="panel-json-raw"
          aria-labelledby="tab-json-raw"
          className="p-6 relative bg-slate-950 animate-fade-in"
        >
          <div className="flex justify-end mb-3">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleCopyJson}
              aria-label="Copiar JSON Bruto para Área de Transferência"
              iconLeft={copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
              className="min-h-[44px] px-4"
            >
              {copied ? 'Copiado com Sucesso!' : 'Copiar JSON'}
            </Button>
          </div>

          <pre className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono text-purple-300 overflow-x-auto max-h-[360px] scrollbar-thin scrollbar-thumb-slate-800 leading-relaxed">
            {JSON.stringify(result.rawJson, null, 2)}
          </pre>
        </div>
      )}
    </Card>
  );
};

export default ResultPreviewCard;
