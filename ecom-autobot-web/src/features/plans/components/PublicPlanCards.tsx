import React from 'react';
import {
  Check,
  Zap,
  Sparkles,
  ShieldCheck,
  ExternalLink,
  Gift,
  HelpCircle,
} from 'lucide-react';
import type { Plan } from '../types/plan.type';
import { Card } from '@/components/ui/display/Card';
import { Badge } from '@/components/ui/feedback/Badge';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/feedback/Skeleton';
import { cn } from '@/utils/cn';

export interface PublicPlanCardsProps {
  plans: Plan[];
  loading?: boolean;
  onSubscribePlan?: (plan: Plan) => void;
  currentPlanId?: string | null;
  className?: string;
}

export const PublicPlanCards: React.FC<PublicPlanCardsProps> = ({
  plans,
  loading = false,
  onSubscribePlan,
  currentPlanId,
  className,
}) => {
  // Formatação de moeda em Reais R$
  const formatCurrency = (amount?: number | null, currency = 'BRL'): string => {
    if (amount == null) return 'R$ 0,00';
    try {
      return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: currency || 'BRL',
      }).format(amount);
    } catch {
      return `R$ ${amount.toFixed(2)}`;
    }
  };

  // Formatação amigável do ciclo de cobrança
  const formatBillingCycle = (autoRecurring?: Plan['auto_recurring']): string => {
    if (!autoRecurring) return '/ mês';
    const frequency = (autoRecurring as any).frequency || 1;
    const frequencyType = (autoRecurring as any).frequency_type || 'months';

    if (frequencyType === 'months') {
      if (frequency === 1) return '/ mês';
      if (frequency === 12) return '/ ano';
      return `/ ${frequency} meses`;
    }

    if (frequencyType === 'days') {
      if (frequency === 30) return '/ mês';
      if (frequency === 7) return '/ semana';
      return `/ ${frequency} dias`;
    }

    return `a cada ${frequency} ${frequencyType}`;
  };

  // Recursos padrão exibidos por plano para enriquecer a UX
  const defaultFeatures = [
    'Scraping automático via JSON-LD & LLM Fallback',
    'Enriquecimento com IA (DeepSeek / Groq)',
    'Exportação de Catálogo (CSV / Shopify / Nuvemshop)',
    'Rate Limit & Multi-Tenant Isolado',
    'Suporte e Atualizações Contínuas',
  ];

  if (loading) {
    return (
      <div className={cn('grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6', className)}>
        {Array.from({ length: 3 }).map((_, idx) => (
          <Card key={`plan-skeleton-${idx}`} className="p-6 space-y-6">
            <div className="space-y-2">
              <Skeleton className="h-6 w-32 rounded" />
              <Skeleton className="h-4 w-48 rounded" />
            </div>
            <Skeleton className="h-10 w-36 rounded-lg" />
            <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <Skeleton className="h-4 w-full rounded" />
              <Skeleton className="h-4 w-full rounded" />
              <Skeleton className="h-4 w-4/5 rounded" />
            </div>
            <Skeleton className="h-11 w-full rounded-xl mt-6" />
          </Card>
        ))}
      </div>
    );
  }

  if (plans.length === 0) {
    return (
      <Card className="p-12 text-center border-dashed border-2 border-slate-200 dark:border-slate-800">
        <div className="flex flex-col items-center justify-center gap-3">
          <HelpCircle className="w-10 h-10 text-slate-400" />
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">
            Nenhum plano disponível no momento
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md">
            Entre em contato com o suporte ou aguarde a publicação de novos planos recorrentes.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className={cn('grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch', className)}>
      {plans.map((plan, idx) => {
        const autoRecurring = plan.auto_recurring as any;
        const amount = autoRecurring?.transaction_amount || 0;
        const currency = autoRecurring?.currency_id || 'BRL';
        const freeTrial = autoRecurring?.free_trial;
        const isFeatured = idx === 1 || plan.reason.toLowerCase().includes('pro');
        const isCurrent = currentPlanId === plan.id;
        const isActive = plan.status === 'active';

        return (
          <Card
            key={plan.id}
            glass={isFeatured}
            className={cn(
              'relative flex flex-col justify-between p-6 sm:p-8 transition-all duration-300 rounded-3xl border',
              isFeatured
                ? 'border-indigo-500 dark:border-indigo-500/80 ring-2 ring-indigo-500/20 shadow-xl bg-gradient-to-b from-white via-slate-50/50 to-indigo-50/20 dark:from-slate-900 dark:via-slate-900/90 dark:to-indigo-950/30'
                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700 shadow-sm hover:shadow-md'
            )}
          >
            {/* Tag de "Mais Popular" para o plano destaque */}
            {isFeatured && (
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-indigo-600 text-white shadow-md">
                  <Sparkles className="w-3.5 h-3.5" /> Mais Recomendado
                </span>
              </div>
            )}

            <div className="space-y-6">
              {/* Nome do Plano e Status */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                    {plan.reason}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Assinatura automatizada via Mercado Pago
                  </p>
                </div>
                {freeTrial && freeTrial.frequency > 0 && (
                  <Badge variant="purple" icon={<Gift className="w-3 h-3" />}>
                    {freeTrial.frequency} dias grátis
                  </Badge>
                )}
              </div>

              {/* Preço e Ciclo */}
              <div className="flex items-baseline gap-1.5 pb-4 border-b border-slate-100 dark:border-slate-800">
                <span className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                  {formatCurrency(amount, currency)}
                </span>
                <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                  {formatBillingCycle(autoRecurring)}
                </span>
              </div>

              {/* Lista de Recursos Incluídos */}
              <div className="space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block mb-2">
                  Recursos do Plano:
                </span>
                {defaultFeatures.map((feat, fIdx) => (
                  <div key={fIdx} className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-700 dark:text-slate-300">
                    <div className="w-4 h-4 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                    </div>
                    <span>{feat}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Botão de Ação "Assinar Agora" */}
            <div className="pt-6 mt-6 border-t border-slate-100 dark:border-slate-800">
              {isCurrent ? (
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  disabled
                  className="w-full h-11 min-h-[44px] text-sm font-semibold border-emerald-500 text-emerald-600 dark:text-emerald-400"
                  iconLeft={<ShieldCheck className="w-4 h-4" />}
                >
                  Plano Atual Ativo
                </Button>
              ) : (
                <Button
                  type="button"
                  variant={isFeatured ? 'primary' : 'outline'}
                  size="md"
                  disabled={!isActive}
                  className={cn(
                    'w-full h-11 min-h-[44px] text-sm font-bold shadow-xs',
                    isFeatured && 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white'
                  )}
                  iconLeft={<Zap className="w-4 h-4" />}
                  iconRight={plan.init_point ? <ExternalLink className="w-4 h-4" /> : undefined}
                  onClick={() => {
                    if (onSubscribePlan) {
                      onSubscribePlan(plan);
                    } else if (plan.init_point) {
                      window.open(plan.init_point, '_blank', 'noopener,noreferrer');
                    }
                  }}
                >
                  {isActive ? 'Assinar Agora' : 'Plano Indisponível'}
                </Button>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
};
