import React from 'react';
import { Sparkles, CreditCard, XCircle, Zap, Calendar, ShieldCheck } from 'lucide-react';
import type { SubscriptionDetails } from '../types/subscription.types';
import { cn } from '@/utils/cn';

export interface ActiveSubscriptionCardProps {
  subscription?: SubscriptionDetails;
  onManageCard?: () => void;
  onCancelSubscription?: () => void;
  isLoading?: boolean;
  className?: string;
}

export const ActiveSubscriptionCard: React.FC<ActiveSubscriptionCardProps> = ({
  subscription = {
    planName: 'Plano Pro',
    priceFormatted: 'R$ 149,00',
    status: 'active',
    renewalDate: '15 de Agosto, 2026',
    creditsUsed: 850,
    creditsTotal: 1000,
    resetDaysLeft: 18,
  },
  onManageCard,
  onCancelSubscription,
  className,
}) => {
  const percentage = Math.min(100, Math.round((subscription.creditsUsed / subscription.creditsTotal) * 100));

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border border-purple-500/20 bg-[#111827] p-6 sm:p-8 shadow-xl backdrop-blur-md',
        className
      )}
    >
      {/* Background Glow */}
      <div
        className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-purple-600/10 blur-3xl pointer-events-none"
        aria-hidden="true"
      />

      {/* Header with Title & Badge */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-purple-600/20 text-[#8B5CF6] border border-purple-500/30">
            <Zap className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Plano Atual</span>
              {/* PRO ACTIVE Badge */}
              <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/10 px-3 py-1 text-xs font-bold text-[#8B5CF6] border border-purple-500/30">
                <Sparkles className="h-3.5 w-3.5 animate-pulse text-[#8B5CF6]" />
                PRO ACTIVE
              </span>
            </div>
            <h3 className="text-2xl font-black text-white tracking-tight mt-0.5">{subscription.planName}</h3>
          </div>
        </div>

        <div className="text-right">
          <div className="text-2xl font-extrabold text-white">{subscription.priceFormatted}</div>
          <div className="text-xs text-gray-400">Faturamento mensal</div>
        </div>
      </div>

      {/* Progress Bar of AI Credits */}
      <div className="mb-6 rounded-xl bg-gray-950/60 p-4 border border-gray-800">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="font-semibold text-gray-300 flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-[#8B5CF6]" /> Créditos de IA Consumidos
          </span>
          <span className="font-mono text-xs font-bold text-gray-200">
            <span className="text-[#8B5CF6]">{subscription.creditsUsed}</span> / {subscription.creditsTotal} créditos ({percentage}%)
          </span>
        </div>
        
        {/* Progress Track */}
        <div className="h-3 w-full rounded-full bg-gray-800 overflow-hidden p-0.5">
          <div
            className="h-full rounded-full bg-gradient-to-r from-purple-600 to-[#8B5CF6] transition-all duration-500 shadow-sm"
            style={{ width: `${percentage}%` }}
          />
        </div>
        
        <div className="mt-2.5 flex items-center justify-between text-xs text-gray-400">
          <span className="flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5 text-gray-500" /> Renovação em {subscription.renewalDate}
          </span>
          <span>Reseta em {subscription.resetDaysLeft} dias</span>
        </div>
      </div>

      {/* Actions Section */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-gray-800">
        <div className="flex items-center gap-2 text-xs text-emerald-400 font-medium">
          <ShieldCheck className="h-4 w-4 shrink-0" />
          <span>Assinatura ativa e protegida</span>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {/* Cancel Button */}
          <button
            type="button"
            onClick={onCancelSubscription}
            className="h-11 min-h-[44px] px-4 rounded-xl text-sm font-medium text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors flex items-center justify-center gap-2 w-full sm:w-auto cursor-pointer"
          >
            <XCircle className="h-4 w-4" />
            Cancelar Assinatura
          </button>

          {/* Manage Card Button */}
          <button
            type="button"
            onClick={onManageCard}
            className="h-11 min-h-[44px] px-5 rounded-xl text-sm font-semibold bg-purple-600 hover:bg-purple-500 text-white transition-all shadow-lg shadow-purple-600/20 active:scale-[0.98] flex items-center justify-center gap-2 w-full sm:w-auto cursor-pointer"
          >
            <CreditCard className="h-4 w-4" />
            Gerenciar Cartão
          </button>
        </div>
      </div>
    </div>
  );
};
