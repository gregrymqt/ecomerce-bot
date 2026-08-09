import React from 'react';
import { Zap, Check } from 'lucide-react';
import { Card } from '@/components/ui';
import { cn } from '@/lib/utils';
import type { AiProviderId, AiProviderMeta, UserAiKey } from '@/features/ai-keys';

export interface ActiveProviderSelectorProps {
  providers: AiProviderMeta[];
  activeProvider: AiProviderId;
  keys: Record<AiProviderId, UserAiKey>;
  onSelectActiveProvider: (providerId: AiProviderId) => void;
  className?: string;
}

export const ActiveProviderSelector: React.FC<ActiveProviderSelectorProps> = ({
  providers,
  activeProvider,
  keys,
  onSelectActiveProvider,
  className,
}) => {
  return (
    <Card
      className={cn(
        'flex flex-col gap-4 border-slate-800 bg-slate-900/90 shadow-xl',
        className
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30 shadow-[0_0_12px_rgba(139,92,246,0.3)]">
            <Zap className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-bold text-white text-base">Provedor Principal Padrão</h3>
            <p className="text-xs text-slate-400 font-mono">
              Selecione qual modelo será utilizado por padrão nas requisições de enriquecimento.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {providers.map((provider) => {
          const isSelected = provider.id === activeProvider;
          const userKey = keys[provider.id];
          const hasCustomKey = Boolean(userKey?.apiKey && userKey?.isValidated);

          return (
            <button
              key={provider.id}
              type="button"
              onClick={() => onSelectActiveProvider(provider.id)}
              className={cn(
                'relative flex flex-col items-start justify-between rounded-xl border p-3.5 text-left transition-all duration-200 min-h-[64px] cursor-pointer',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500',
                isSelected
                  ? 'border-purple-500 bg-purple-950/40 text-white shadow-[0_0_15px_rgba(139,92,246,0.2)]'
                  : 'border-slate-800 bg-slate-950/60 text-slate-300 hover:border-slate-700 hover:bg-slate-900/80'
              )}
            >
              <div className="flex w-full items-center justify-between gap-1">
                <span className="font-semibold text-sm truncate">{provider.name}</span>
                {isSelected && (
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-purple-500 text-white shadow-sm">
                    <Check className="h-3 w-3 stroke-[3]" />
                  </span>
                )}
              </div>

              <div className="mt-2 flex w-full items-center justify-between text-[11px] font-mono">
                <span className="text-slate-400 font-medium">{provider.badgeText}</span>
                <span
                  className={cn(
                    'font-medium',
                    hasCustomKey ? 'text-emerald-400' : 'text-slate-500'
                  )}
                >
                  {hasCustomKey ? 'Chave própria' : 'Chave global'}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </Card>
  );
};

