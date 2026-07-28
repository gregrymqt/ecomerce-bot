import React from 'react';
import { Sparkles, ArrowRight, ExternalLink, ShieldCheck } from 'lucide-react';
import { cn } from '@/utils/cn';

export interface BottomCtaBannerProps {
  onStartFreeTrial?: () => void;
  onViewDocs?: () => void;
  className?: string;
}

export const BottomCtaBanner: React.FC<BottomCtaBannerProps> = ({
  onStartFreeTrial,
  onViewDocs,
  className,
}) => {
  return (
    <div
      className={cn(
        'fixed bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-5xl z-50 rounded-2xl p-4 sm:p-5 bg-slate-900/95 border border-purple-500/40 shadow-2xl shadow-purple-950/60 backdrop-blur-xl flex flex-col sm:flex-row items-center justify-between gap-4 transition-all',
        className
      )}
    >
      {/* Texto de Chamada */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-purple-950/80 border border-purple-500/40 flex items-center justify-center shrink-0 shadow-inner">
          <Sparkles className="w-5 h-5 text-purple-400 animate-pulse" />
        </div>
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <h4 className="text-sm sm:text-base font-extrabold text-white">
              Pronto para automação em massa no seu e-commerce?
            </h4>
            <span className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-500/30">
              <ShieldCheck className="w-3 h-3" /> 7 DIAS GRÁTIS
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Extraia catálogos inteiros, sincronize com a Shopify e multiplique suas vendas.
          </p>
        </div>
      </div>

      {/* Botões de Ação */}
      <div className="flex items-center gap-2.5 w-full sm:w-auto shrink-0">
        {onViewDocs && (
          <button
            type="button"
            onClick={onViewDocs}
            className="min-h-[44px] h-11 px-4 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-800 border border-slate-700 transition-all flex items-center justify-center gap-1.5 flex-1 sm:flex-initial"
          >
            <span>Docs da API</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        )}

        <button
          type="button"
          onClick={onStartFreeTrial}
          className="min-h-[44px] h-11 px-5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-lg shadow-purple-600/30 transition-all active:scale-95 flex items-center justify-center gap-2 flex-1 sm:flex-initial"
        >
          <span>Testar Grátis 7 Dias</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
