/**
 * src/features/wallet/components/cards/PlanCard.tsx
 *
 * Card visual para exibição de Planos SaaS (Free, Starter, Pro, Enterprise).
 * Tema Synthetica Dark (#090D16, #15121B, #1E293B, accents indigo/emerald).
 */

import React from 'react';
import { Check, Sparkles, Zap, ShieldCheck } from 'lucide-react';
import { Button, Badge } from '@/components/ui';
import { cn } from '@/lib/utils';
import type { SaaSPlan } from '../../types';

export interface PlanCardProps {
  plan: SaaSPlan;
  isAnnual: boolean;
  isCurrentPlan: boolean;
  onSelectPlan: (plan: SaaSPlan) => void;
  className?: string;
}

export const PlanCard: React.FC<PlanCardProps> = ({
  plan,
  isAnnual,
  isCurrentPlan,
  onSelectPlan,
  className,
}) => {
  const price = isAnnual ? plan.price_annual_brl : plan.price_monthly_brl;
  const isFree = plan.tier === 'free';

  return (
    <div
      className={cn(
        'relative rounded-2xl p-6 flex flex-col justify-between transition-all duration-300 border',
        plan.is_popular
          ? 'bg-gradient-to-b from-indigo-950/40 via-[#15121B] to-[#090D16] border-indigo-500/50 shadow-xl shadow-indigo-500/10'
          : 'bg-[#15121B] border-[#1E293B] hover:border-slate-700',
        className
      )}
    >
      {/* Badge de Popular ou Plano Ativo */}
      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
        {isCurrentPlan ? (
          <Badge variant="success" icon={<ShieldCheck className="w-3.5 h-3.5" />}>
            Plano Atual
          </Badge>
        ) : plan.is_popular ? (
          <Badge variant="info" icon={<Sparkles className="w-3.5 h-3.5" />}>
            Mais Escolhido
          </Badge>
        ) : null}
      </div>

      <div>
        {/* Cabeçalho do Plano */}
        <div className="space-y-2 pb-5 border-b border-slate-800">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-white tracking-tight">{plan.name}</h3>
            {plan.tier === 'pro' && <Zap className="w-5 h-5 text-amber-400" />}
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">{plan.description}</p>
        </div>

        {/* Preço */}
        <div className="py-6">
          <div className="flex items-baseline gap-1">
            <span className="text-xs font-bold text-slate-400">R$</span>
            <span className="text-3xl sm:text-4xl font-black text-white font-mono tracking-tight">
              {isFree ? '0' : price.toFixed(0)}
            </span>
            <span className="text-xs text-slate-400">
              {isFree ? 'para sempre' : isAnnual ? '/ano' : '/mês'}
            </span>
          </div>

          {!isFree && plan.trial_days ? (
            <p className="text-[11px] text-emerald-400 font-semibold mt-1">
              🎉 Inclui {plan.trial_days} dias de degustação sem cobrança
            </p>
          ) : null}

          <div className="mt-3 py-1.5 px-3 rounded-lg bg-slate-900/80 border border-slate-800/80 text-xs text-indigo-300 font-mono">
            {isFree ? 'Créditos de degustação' : `${plan.credits_included.toLocaleString('pt-BR')} créditos/mês inclusos`}
          </div>
        </div>

        {/* Lista de Recursos */}
        <ul className="space-y-3 py-4 text-xs text-slate-300">
          {plan.features.map((feature, idx) => (
            <li key={idx} className="flex items-start gap-2.5">
              <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Botão de Ação (min-h-[44px]) */}
      <div className="pt-6 border-t border-slate-800/80">
        <Button
          type="button"
          variant={isCurrentPlan ? 'outline' : plan.is_popular ? 'primary' : 'secondary'}
          size="md"
          disabled={isCurrentPlan}
          onClick={() => onSelectPlan(plan)}
          className={cn(
            'w-full min-h-[44px] font-bold text-xs sm:text-sm cursor-pointer',
            isCurrentPlan && 'border-slate-800 text-slate-400 cursor-not-allowed'
          )}
        >
          {isCurrentPlan ? 'Plano Ativo' : isFree ? 'Plano Básico' : 'Fazer Upgrade'}
        </Button>
      </div>
    </div>
  );
};

export default PlanCard;
