import React from 'react';
import { Sparkles, Calendar, Zap, CreditCard, XCircle, ShieldCheck } from 'lucide-react';
import { Card, Badge, Button, ProgressBar } from '@/components/ui';
import type { SubscriptionDetails } from '@/features/subscription';
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
    <Card
      className={cn(
        'relative overflow-hidden rounded-2xl p-6 sm:p-8 bg-[#15121B] border border-slate-800 shadow-2xl backdrop-blur-xl',
        className
      )}
    >
      {/* Dynamic Background Aura Glow */}
      <div className="absolute -top-24 -right-24 w-64 h-64 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800/80">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-purple-950/60 border border-purple-500/30 flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(139,92,246,0.2)]">
            <Zap className="w-6 h-6 text-purple-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-black text-white tracking-tight">{subscription.planName}</h3>
              <Badge variant="purple" dot icon={<ShieldCheck className="w-3.5 h-3.5" />}>
                ATIVO
              </Badge>
            </div>
            <p className="text-xs text-slate-400 mt-0.5 font-mono">
              Assinatura vinculada ao Tenant • Renova em {subscription.renewalDate} ({subscription.resetDaysLeft} dias)
            </p>
          </div>
        </div>

        <div className="text-left sm:text-right font-mono">
          <div className="text-2xl font-black text-white tracking-tight">
            {subscription.priceFormatted}
            <span className="text-xs font-normal text-slate-400">/mês</span>
          </div>
          <span className="text-[11px] text-emerald-400 font-semibold flex items-center justify-start sm:justify-end gap-1">
            • Pagamento Automático Ativo
          </span>
        </div>
      </div>

      {/* Usage Progress Section */}
      <div className="py-6 border-b border-slate-800/80 space-y-3">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-300 font-mono">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span>Cota de Produtos Raspados/Enriquecidos (IA)</span>
          </div>
          <span className="text-purple-300 font-mono">
            {subscription.creditsUsed.toLocaleString()} / {subscription.creditsTotal.toLocaleString()} ({percentage}%)
          </span>
        </div>

        <ProgressBar value={percentage} color="indigo" showPercentage={false} />

        <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 font-mono">
          <span>Renovação em {subscription.renewalDate}</span>
          <span className="text-slate-300 font-medium">
            Reseta em {subscription.resetDaysLeft} dias
          </span>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
          <Calendar className="w-4 h-4 text-slate-500" />
          <span>Renovação: {subscription.renewalDate}</span>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {onCancelSubscription && (
            <Button
              type="button"
              variant="ghost"
              onClick={onCancelSubscription}
              iconLeft={<XCircle className="w-4 h-4 text-rose-400" />}
              className="w-full sm:w-auto text-slate-400 hover:text-rose-400"
            >
              Cancelar Assinatura
            </Button>
          )}

          {onManageCard && (
            <Button
              type="button"
              variant="primary"
              onClick={onManageCard}
              iconLeft={<CreditCard className="w-4 h-4" />}
              className="w-full sm:w-auto"
            >
              Gerenciar Cartão
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
};

