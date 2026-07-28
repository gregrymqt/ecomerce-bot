import React, { useState } from 'react';
import { CheckCircle2, Sparkles, Zap, Building2, Check, ArrowRight } from 'lucide-react';
import type { BillingCycle, PlanTier } from '../types/subscription.types';
import { cn } from '@/utils/cn';

export interface PricingSectionProps {
  currentPlanId?: 'starter' | 'pro' | 'enterprise';
  onSelectPlan?: (plan: PlanTier, cycle: BillingCycle) => void;
  className?: string;
}

const DEFAULT_PLANS: PlanTier[] = [
  {
    id: 'starter',
    name: 'Starter',
    priceMonthly: 49,
    priceYearly: 39,
    credits: 200,
    features: [
      'Até 200 produtos extraídos/mês',
      'Enriquecimento com IA Standard',
      'Exportação para CSV e JSON',
      'Suporte comunitário via Discord',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    priceMonthly: 149,
    priceYearly: 119,
    credits: 1000,
    features: [
      'Até 1.000 produtos extraídos/mês',
      'Modelos DeepSeek V3, Groq & GPT-4o',
      'Sync direto com Shopify & Nuvemshop',
      'Cadastro de Chaves Próprias (BYOK)',
      'Suporte Prioritário 24/7',
    ],
    isPopular: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    priceMonthly: 399,
    priceYearly: 319,
    credits: 5000,
    features: [
      'Produtos e Scraping Ilimitados',
      'API Key Dedicada com High Throughput',
      'Servidores Exclusivos de Raspagem',
      'Gerente de Conta e Onboarding VIP',
      'SLA Garantido de 99.9% de Uptime',
    ],
  },
];

export const PricingSection: React.FC<PricingSectionProps> = ({
  currentPlanId = 'pro',
  onSelectPlan,
  className,
}) => {
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');

  const handlePlanClick = (plan: PlanTier) => {
    if (onSelectPlan) {
      onSelectPlan(plan, billingCycle);
    }
  };

  return (
    <div className={cn('space-y-8', className)}>
      {/* Title & Cycle Toggle Header */}
      <div className="flex flex-col items-center text-center space-y-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-[#8B5CF6]">
            Planos & Preços
          </span>
          <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight mt-1">
            Escolha o plano ideal para escalar seu e-commerce
          </h2>
          <p className="text-sm text-gray-400 max-w-xl mx-auto mt-2">
            Desbloqueie o poder da inteligência artificial para extrair, transformar e publicar catálogos em segundos.
          </p>
        </div>

        {/* Reactive Cycle Toggle Pills */}
        <div className="inline-flex items-center rounded-2xl bg-gray-900 p-1.5 border border-gray-800 shadow-inner">
          <button
            type="button"
            onClick={() => setBillingCycle('monthly')}
            className={cn(
              'h-11 min-h-[44px] px-6 rounded-xl text-sm font-semibold transition-all duration-200 cursor-pointer select-none',
              billingCycle === 'monthly'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
                : 'text-gray-400 hover:text-white'
            )}
          >
            Cobrança Mensal
          </button>
          
          <button
            type="button"
            onClick={() => setBillingCycle('yearly')}
            className={cn(
              'h-11 min-h-[44px] px-6 rounded-xl text-sm font-semibold transition-all duration-200 cursor-pointer select-none flex items-center gap-2',
              billingCycle === 'yearly'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
                : 'text-gray-400 hover:text-white'
            )}
          >
            <span>Cobrança Anual</span>
            <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-bold text-emerald-400 border border-emerald-500/30">
              20% OFF
            </span>
          </button>
        </div>
      </div>

      {/* Grid of 3 Plan Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
        {DEFAULT_PLANS.map((plan) => {
          const isCurrent = plan.id === currentPlanId;
          const isPopular = Boolean(plan.isPopular);
          const price = billingCycle === 'yearly' ? plan.priceYearly : plan.priceMonthly;

          return (
            <div
              key={plan.id}
              className={cn(
                'relative flex flex-col justify-between rounded-2xl p-6 sm:p-8 transition-all duration-300 shadow-xl',
                isPopular
                  ? 'bg-[#111827] border-2 border-[#8B5CF6] shadow-purple-600/10 ring-1 ring-[#8B5CF6]/50 scale-[1.02] z-10'
                  : 'bg-[#111827] border border-gray-800 hover:border-gray-700'
              )}
            >
              {/* Popular Badge */}
              {isPopular && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-1 text-xs font-black uppercase tracking-wider text-white shadow-lg">
                    <Sparkles className="h-3.5 w-3.5 text-white animate-spin-slow" />
                    MAIS POPULAR
                  </span>
                </div>
              )}

              <div>
                {/* Header info */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    {plan.id === 'starter' && <Zap className="h-5 w-5 text-indigo-400" />}
                    {plan.id === 'pro' && <Sparkles className="h-5 w-5 text-[#8B5CF6]" />}
                    {plan.id === 'enterprise' && <Building2 className="h-5 w-5 text-emerald-400" />}
                    <h3 className="text-xl font-black text-white">{plan.name}</h3>
                  </div>
                </div>

                {/* Price Display */}
                <div className="mb-6">
                  <div className="flex items-baseline gap-1">
                    <span className="text-xs font-bold text-gray-400">R$</span>
                    <span className="text-4xl font-extrabold text-white tracking-tight">{price}</span>
                    <span className="text-xs text-gray-400 font-medium">/mês</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    {billingCycle === 'yearly' ? 'Faturado anualmente (economia de 20%)' : 'Faturado mensalmente'}
                  </p>
                </div>

                {/* Feature List */}
                <div className="space-y-3 pt-4 border-t border-gray-800/80 mb-6">
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Recursos incluídos:</p>
                  <ul className="space-y-2.5">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2.5 text-xs text-gray-300">
                        <CheckCircle2 className="h-4 w-4 text-[#8B5CF6] shrink-0 mt-0.5" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-4 border-t border-gray-800/60">
                {isCurrent ? (
                  <button
                    type="button"
                    disabled
                    className="w-full h-11 min-h-[44px] px-4 rounded-xl text-sm font-semibold bg-gray-800/80 text-gray-400 border border-gray-700/60 flex items-center justify-center gap-2 cursor-not-allowed select-none"
                  >
                    <Check className="h-4 w-4 text-emerald-400" />
                    <span>Seu Plano Atual</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handlePlanClick(plan)}
                    className={cn(
                      'w-full h-11 min-h-[44px] px-4 rounded-xl text-sm font-semibold transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer',
                      isPopular
                        ? 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-lg shadow-purple-600/25'
                        : 'bg-gray-800 hover:bg-gray-700 text-white border border-gray-700'
                    )}
                  >
                    <span>Contratar {plan.name}</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
