import React from 'react';
import { Eye, Code, Sparkles, CheckCircle2, Copy, Check, Tag, Award } from 'lucide-react';
import type { ScrapedProductResult } from '../types/live-demo.types';
import { useResultPreviewCard } from '../hooks/useResultPreviewCard';
import { cn } from '@/utils/cn';

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
    <div
      className={cn(
        'w-full rounded-2xl overflow-hidden bg-slate-900/90 border border-purple-500/30 shadow-2xl backdrop-blur-md flex flex-col',
        className
      )}
    >
      {/* Header com Abas */}
      <div className="flex items-center justify-between px-6 py-4 bg-slate-950/80 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-400" />
          <h3 className="text-base font-bold text-white">Resultado Enriquecido por IA</h3>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-900 rounded-xl border border-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab('visual')}
            className={cn(
              'min-h-[40px] px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5',
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
            onClick={() => setActiveTab('json')}
            className={cn(
              'min-h-[40px] px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5',
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
        <div className="p-6 grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
          {/* Imagem do Produto */}
          <div className="md:col-span-5 relative group rounded-2xl overflow-hidden border border-slate-800 bg-slate-950">
            <img
              src={result.imageUrl}
              alt={result.titleMagnetic}
              className="w-full h-64 object-cover object-center group-hover:scale-105 transition-transform duration-500"
            />
            <div className="absolute top-3 left-3 px-3 py-1 rounded-full text-[11px] font-bold tracking-wider bg-purple-950/90 text-purple-300 border border-purple-500/40 backdrop-blur-md shadow-lg flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-yellow-300 animate-pulse" />
              AI ENHANCED
            </div>
            <div className="absolute bottom-3 right-3 px-3 py-1 rounded-lg bg-slate-950/90 text-emerald-400 font-mono font-bold text-sm border border-emerald-500/30 shadow-lg">
              {result.price}
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
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="px-3 py-1 rounded-lg text-xs font-semibold bg-purple-950/60 text-purple-300 border border-purple-500/30 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-purple-400" />
                {result.category}
              </span>
              <span className="px-3 py-1 rounded-lg text-xs font-semibold bg-indigo-950/60 text-indigo-300 border border-indigo-500/30">
                Tom: {result.tone}
              </span>
              <span className="px-3 py-1 rounded-lg text-xs font-semibold bg-emerald-950/60 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                <Award className="w-3.5 h-3.5" />
                SEO Score: {result.seoScore}/100
              </span>
            </div>

            {/* Bullet Points */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Benefícios de Alta Conversão:
              </h4>
              <ul className="space-y-2">
                {result.bulletPoints.map((bullet, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-xs text-slate-300 leading-relaxed">
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
        <div className="p-6 relative bg-slate-950">
          <button
            type="button"
            onClick={handleCopyJson}
            className="absolute top-8 right-8 min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all flex items-center gap-1.5 shadow-md"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">Copiado!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-400" />
                <span>Copiar JSON</span>
              </>
            )}
          </button>

          <pre className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono text-purple-300 overflow-x-auto max-h-[360px] scrollbar-thin scrollbar-thumb-slate-800 leading-relaxed">
            {JSON.stringify(result.rawJson, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};
