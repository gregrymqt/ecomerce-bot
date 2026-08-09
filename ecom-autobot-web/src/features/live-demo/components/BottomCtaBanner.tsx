import React from 'react';
import { Sparkles, ArrowRight, ExternalLink, ShieldCheck } from 'lucide-react';
import { Badge, Button } from '@/components/ui';
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
        'sticky bottom-6 z-30 w-[calc(100%-2rem)] max-w-5xl mx-auto rounded-2xl p-4 sm:p-5 bg-slate-900/95 border border-purple-500/40 shadow-2xl shadow-purple-950/60 backdrop-blur-xl flex flex-col sm:flex-row items-center justify-between gap-4 transition-all',
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
            <span className="hidden md:inline-flex">
              <Badge variant="success" icon={<ShieldCheck className="w-3 h-3" />}>
                7 DIAS GRÁTIS
              </Badge>
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
          <Button
            type="button"
            variant="secondary"
            onClick={onViewDocs}
            iconRight={<ExternalLink className="w-3.5 h-3.5" />}
            className="flex-1 sm:flex-initial"
          >
            Docs da API
          </Button>
        )}

        <Button
          type="button"
          variant="primary"
          onClick={onStartFreeTrial}
          iconRight={<ArrowRight className="w-4 h-4" />}
          className="flex-1 sm:flex-initial"
        >
          Testar Grátis 7 Dias
        </Button>
      </div>
    </div>
  );
};

