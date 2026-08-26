import React from 'react';
import { Zap, Link2, Sparkles, ArrowRight } from 'lucide-react';
import { Input, Button } from '@/components/ui';
import { SAMPLE_URLS } from '@/features/live-demo';
import { useDemoHeroInput } from '@/features/live-demo';
import { cn } from '@/utils/cn';

export interface DemoHeroInputProps {
  onSubmit: (url: string) => void;
  isLoading?: boolean;
  className?: string;
}

export const DemoHeroInput: React.FC<DemoHeroInputProps> = ({
  onSubmit,
  isLoading = false,
  className,
}) => {
  const {
    urlInput,
    error,
    handleInputChange,
    handleSelectSample,
    handleSubmit,
  } = useDemoHeroInput({ onSubmit });

  return (
    <div className={cn('w-full max-w-4xl mx-auto flex flex-col items-center gap-6', className)}>
      <form onSubmit={handleSubmit} className="w-full flex flex-col gap-3">
        <div className="relative flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-2 rounded-2xl bg-slate-900/90 border border-purple-500/30 shadow-xl shadow-purple-950/20 backdrop-blur-md">
          <div className="relative flex-1 flex items-center">
            <Input
              type="text"
              value={urlInput}
              onChange={handleInputChange}
              placeholder="Cole a URL do produto (Shopify, Nuvemshop, Mercado Livre...)"
              disabled={isLoading}
              iconLeft={<Link2 className="w-5 h-5 text-slate-400" />}
              className="bg-transparent border-none focus:ring-0 text-white placeholder-slate-400"
            />
          </div>

          <Button
            type="submit"
            disabled={isLoading}
            isLoading={isLoading}
            variant="primary"
            iconLeft={!isLoading ? <Zap className="w-5 h-5 text-yellow-300 animate-pulse" /> : undefined}
            className="shrink-0"
          >
            {isLoading ? 'Extraindo...' : 'Iniciar Demonstração Ao Vivo'}
          </Button>
        </div>

        {error && (
          <p className="text-xs text-rose-400 font-medium pl-3 animate-fade-in font-mono">
            {error}
          </p>
        )}
      </form>

      {/* Pills de acesso rápido */}
      <div className="w-full flex flex-wrap items-center justify-center gap-2">
        <span className="text-xs text-slate-400 font-medium mr-1 flex items-center gap-1 font-mono">
          <Sparkles className="w-3.5 h-3.5 text-purple-400" />
          Testes rápidos:
        </span>
        {SAMPLE_URLS.map((sample, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => handleSelectSample(sample)}
            disabled={isLoading}
            className="min-h-[40px] px-4 py-2 rounded-full text-xs font-medium font-mono text-purple-300 bg-purple-950/40 hover:bg-purple-900/60 border border-purple-500/20 hover:border-purple-500/50 transition-all flex items-center gap-1.5 active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            <span>{sample.label}</span>
            <ArrowRight className="w-3 h-3 text-purple-400" />
          </button>
        ))}
      </div>
    </div>
  );
};

