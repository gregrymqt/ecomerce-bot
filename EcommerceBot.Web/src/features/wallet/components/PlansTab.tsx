/**
 * src/features/wallet/components/PlansTab.tsx
 *
 * Aba de Comparativo e Contratação de Planos SaaS dentro da Carteira.
 * Apresenta planos Free, Starter, Pro e Enterprise com toggle Mensal/Anual.
 */

import React, { useState } from 'react';
import { Sparkles, Shield, Gift } from 'lucide-react';
import { PlanCard } from './PlanCard';
import { useAuth } from '@/features/auth';
import type { SaaSPlan } from '../types';

export interface PlansTabProps {
  onSelectPlan: (plan: SaaSPlan, isAnnual: boolean) => void;
  className?: string;
}

const SAAS_PLANS: SaaSPlan[] = [
  {
    id: 'free-plan',
    name: 'Free (Degustação)',
    description: 'Experimente a inteligência artificial para extrair e enriquecer produtos de demonstração.',
    price_monthly_brl: 0,
    price_annual_brl: 0,
    credits_included: 50,
    tier: 'free',
    features: [
      'Acesso à página de Live Demo',
      'Extração manual de produtos',
      'Até 50 créditos de degustação',
      'Sem necessidade de cartão de crédito',
    ],
  },
  {
    id: 'starter-plan',
    name: 'Starter AI',
    description: 'Ideal para lojas iniciantes automatizarem o catálogo com copy magnética.',
    price_monthly_brl: 97,
    price_annual_brl: 970,
    credits_included: 1000,
    tier: 'starter',
    trial_days: 7,
    features: [
      '1.000 créditos de IA inclusos todo mês',
      'Exportação para Shopify e Nuvemshop',
      'Geração de títulos e descrições SEO',
      'Suporte via e-mail em até 24h',
      '7 dias de teste gratuito',
    ],
  },
  {
    id: 'pro-plan',
    name: 'Pro AI',
    description: 'Para operações que exigem escala, tráfego inteligente e análise preditiva.',
    price_monthly_brl: 197,
    price_annual_brl: 1970,
    credits_included: 3000,
    is_popular: true,
    tier: 'pro',
    trial_days: 7,
    features: [
      '3.000 créditos de IA inclusos todo mês',
      'Sincronização em lote ultra-rápida',
      'Painel de Tráfego, Ads & ML Preditivo',
      'Consumo com chaves BYOK personalizadas',
      'Suporte prioritário via WhatsApp e e-mail',
      '7 dias de teste gratuito',
    ],
  },
  {
    id: 'enterprise-plan',
    name: 'Enterprise AI',
    description: 'Para grandes redes, agências e operações com alta demanda e governança.',
    price_monthly_brl: 497,
    price_annual_brl: 4970,
    credits_included: 10000,
    tier: 'enterprise',
    trial_days: 14,
    features: [
      '10.000 créditos de IA todo mês',
      'Múltiplos tenants e times dedicados',
      'SSO Corporativo (Okta, SAML, Azure AD)',
      'Modelos customizados Scikit-Learn e Spark',
      'Gerente de contas dedicado e SLA 99.9%',
      '14 dias de teste gratuito',
    ],
  },
];

export const PlansTab: React.FC<PlansTabProps> = ({ onSelectPlan, className }) => {
  const { user } = useAuth();
  const [isAnnual, setIsAnnual] = useState<boolean>(false);

  const currentPlanTier = user?.plan?.toLowerCase() || 'free';

  return (
    <div className={`space-y-8 animate-fade-in ${className || ''}`}>
      {/* Banner Informativo Superior */}
      <div className="rounded-2xl p-6 bg-gradient-to-r from-indigo-950/60 via-purple-950/40 to-slate-900 border border-indigo-500/20 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-2 text-center md:text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-bold">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Planos Flexíveis para seu Negócio</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white">
            Escale sua loja com a automação de e-commerce mais rápida do mercado
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 max-w-2xl">
            Todos os planos pagos contam com ativação imediata via Mercado Pago (PIX e Cartão de Crédito) e período de degustação com garantia incondicional.
          </p>
        </div>

        {/* Seletor Mensal / Anual */}
        <div className="flex items-center gap-3 p-1.5 rounded-xl bg-slate-900/90 border border-slate-800 shrink-0">
          <button
            type="button"
            onClick={() => setIsAnnual(false)}
            className={`min-h-[38px] px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              !isAnnual ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Cobrança Mensal
          </button>
          <button
            type="button"
            onClick={() => setIsAnnual(true)}
            className={`min-h-[38px] px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              isAnnual ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>Anual</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              -17% OFF
            </span>
          </button>
        </div>
      </div>

      {/* Grid de Planos (1 col mobile, 2 cols tablet, 4 cols desktop) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
        {SAAS_PLANS.map((plan) => {
          const isCurrent = currentPlanTier === plan.tier;
          return (
            <PlanCard
              key={plan.id}
              plan={plan}
              isAnnual={isAnnual}
              isCurrentPlan={isCurrent}
              onSelectPlan={() => onSelectPlan(plan, isAnnual)}
            />
          );
        })}
      </div>

      {/* Garantia & Segurança */}
      <div className="rounded-2xl bg-[#15121B] border border-[#1E293B] p-5 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
        <div className="flex items-center gap-3">
          <Shield className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>
            Pagamentos criptografados de ponta a ponta processados via Mercado Pago com suporte a PIX e Cartão de Crédito.
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0 font-medium text-indigo-300">
          <Gift className="w-4 h-4 text-amber-400" />
          <span>Garantia de 7 dias ou seu dinheiro de volta</span>
        </div>
      </div>
    </div>
  );
};

export default PlansTab;
