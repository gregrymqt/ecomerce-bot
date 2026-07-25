import React, { useState } from 'react';
import {
  CreditCard,
  Calendar,
  ShieldCheck,
  Zap,
  AlertTriangle,
  XCircle,
  Clock,
  Sparkles,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';
import type { TenantBillingStatus, Subscription } from '../types/subscription.type';
import { Card } from '@/components/ui/display/Card';
import { Badge, type BadgeVariant } from '@/components/ui/feedback/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/overlay/ConfirmDialog';
import { Skeleton } from '@/components/ui/feedback/Skeleton';
import { cn } from '@/utils/cn';

export interface SubscriptionBillingCardProps {
  billingStatus: TenantBillingStatus | null;
  loading?: boolean;
  actionLoading?: boolean;
  onCancelSubscription: (id: string) => Promise<unknown>;
  onSubscribeClick?: () => void;
  className?: string;
}

export const SubscriptionBillingCard: React.FC<SubscriptionBillingCardProps> = ({
  billingStatus,
  loading = false,
  actionLoading = false,
  onCancelSubscription,
  onSubscribeClick,
  className,
}) => {
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);

  // Formatação de data em Português
  const formatDate = (dateStr?: string | null): string => {
    if (!dateStr) return 'N/A';
    try {
      const date = new Date(dateStr);
      return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      }).format(date);
    } catch {
      return dateStr;
    }
  };

  // Formatação de moeda BRL
  const formatCurrency = (amount?: number | null, currency = 'BRL'): string => {
    if (amount == null) return 'R$ --';
    try {
      return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: currency || 'BRL',
      }).format(amount);
    } catch {
      return `R$ ${amount.toFixed(2)}`;
    }
  };

  // Função auxiliar de Badge por Status da Assinatura
  const getStatusBadge = (hasActive: boolean, sub: Subscription | null) => {
    if (!hasActive || !sub) {
      return (
        <Badge variant="default" dot>
          Sem Assinatura Ativa
        </Badge>
      );
    }

    const map: Record<string, { variant: BadgeVariant; label: string }> = {
      authorized: { variant: 'success', label: 'Ativa / Autorizada' },
      pending: { variant: 'warning', label: 'Pagamento Pendente' },
      paused: { variant: 'info', label: 'Pausada' },
      cancelled: { variant: 'error', label: 'Cancelada' },
    };

    const statusConfig = map[sub.status] || { variant: 'default', label: sub.status };

    return (
      <Badge variant={statusConfig.variant} dot>
        {statusConfig.label}
      </Badge>
    );
  };

  if (loading) {
    return (
      <Card className={cn('p-6 sm:p-8 border border-slate-200 dark:border-slate-800', className)}>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-36 rounded-md" />
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
          <Skeleton className="h-10 w-48 rounded-md" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
          </div>
          <Skeleton className="h-11 w-full sm:w-44 rounded-lg mt-4" />
        </div>
      </Card>
    );
  }

  const activeSub = billingStatus?.subscription;
  const hasActive = Boolean(billingStatus?.has_active_subscription && activeSub?.status === 'authorized');
  const validUntil = billingStatus?.valid_until || activeSub?.next_payment_date;
  const amount = activeSub?.auto_recurring?.transaction_amount;
  const planName = billingStatus?.plan_id
    ? `Plano ${billingStatus.plan_id.toUpperCase()}`
    : activeSub?.reason || 'Plano Personalizado';

  const handleConfirmCancel = async () => {
    if (activeSub?.id) {
      await onCancelSubscription(activeSub.id);
    }
  };

  return (
    <>
      <Card
        glass
        className={cn(
          'relative overflow-hidden border transition-all duration-300 shadow-md p-6 sm:p-8',
          hasActive
            ? 'border-indigo-200 dark:border-indigo-900/60 bg-gradient-to-br from-white via-slate-50/50 to-indigo-50/30 dark:from-slate-900 dark:via-slate-900/90 dark:to-indigo-950/20'
            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900',
          className
        )}
      >
        {/* Glow decorativo de fundo */}
        {hasActive && (
          <div
            className="absolute -right-12 -top-12 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"
            aria-hidden="true"
          />
        )}

        {/* Cabeçalho do Card */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-xs border',
                hasActive
                  ? 'bg-indigo-600 text-white border-indigo-500'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'
              )}
            >
              <CreditCard className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" /> Assinatura do Tenant
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                {planName}
              </h2>
            </div>
          </div>

          <div className="self-start sm:self-center">
            {getStatusBadge(Boolean(billingStatus?.has_active_subscription), activeSub || null)}
          </div>
        </div>

        {/* Informações detalhadas se houver assinatura ativa */}
        {hasActive && activeSub ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Card de Valor / Recorrência */}
              <div className="p-4 rounded-xl bg-white/70 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 backdrop-blur-xs flex flex-col justify-between">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
                  <span>Valor Recorrente</span>
                  <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                </div>
                <div className="text-2xl font-extrabold text-slate-900 dark:text-white">
                  {formatCurrency(amount)}
                  <span className="text-xs font-normal text-slate-500 dark:text-slate-400 ml-1">/mês</span>
                </div>
              </div>

              {/* Card de Próximo Vencimento */}
              <div className="p-4 rounded-xl bg-white/70 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 backdrop-blur-xs flex flex-col justify-between">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
                  <span>Próxima Cobrança</span>
                  <Calendar className="w-3.5 h-3.5 text-emerald-500" />
                </div>
                <div className="text-lg font-bold text-slate-900 dark:text-white truncate">
                  {formatDate(validUntil)}
                </div>
              </div>

              {/* Card de Pagador / Mercado Pago ID */}
              <div className="p-4 rounded-xl bg-white/70 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 backdrop-blur-xs flex flex-col justify-between sm:col-span-2 lg:col-span-1">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
                  <span>E-mail do Pagador</span>
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                </div>
                <div className="text-sm font-semibold text-slate-900 dark:text-white truncate" title={activeSub.payer_email}>
                  {activeSub.payer_email || 'N/A'}
                </div>
                <div className="text-[11px] text-slate-400 truncate mt-1">
                  ID MP: {activeSub.preapproval_id}
                </div>
              </div>
            </div>

            {/* Link direto para checkout se init_point existir */}
            {activeSub.init_point && (
              <div className="flex items-center gap-2 text-xs text-indigo-600 dark:text-indigo-400 font-medium">
                <a
                  href={activeSub.init_point}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 hover:underline"
                >
                  Abrir checkout no Mercado Pago <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            )}

            {/* Ações da Assinatura (Cancelamento) */}
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
              <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>Cobrança automática ativa gerenciada via Mercado Pago Preapproval</span>
              </div>

              <Button
                type="button"
                variant="danger"
                size="md"
                className="w-full sm:w-auto h-11 min-h-[44px] text-sm font-semibold"
                iconLeft={<XCircle className="w-4 h-4" />}
                onClick={() => setIsCancelDialogOpen(true)}
                isLoading={actionLoading}
              >
                Cancelar Assinatura
              </Button>
            </div>
          </div>
        ) : (
          /* Estado sem assinatura ativa */
          <div className="space-y-6">
            <div className="p-5 rounded-2xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-bold text-amber-900 dark:text-amber-200">
                    Sua conta não possui uma assinatura recorrente ativa
                  </h4>
                  <p className="text-xs text-amber-700 dark:text-amber-300/80 mt-1 leading-relaxed">
                    Assine um plano para desbloquear scraping ilimitado, enriquecimento avançado via LLM (DeepSeek/Groq) e sincronização automática com Shopify e Nuvemshop.
                  </p>
                </div>
              </div>

              {onSubscribeClick && (
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  className="w-full sm:w-auto h-11 min-h-[44px] text-sm font-semibold shrink-0"
                  iconLeft={<Zap className="w-4 h-4" />}
                  onClick={onSubscribeClick}
                >
                  Contratar Plano
                </Button>
              )}
            </div>
          </div>
        )}
      </Card>

      {/* Modal / Dialog de Confirmação de Cancelamento */}
      {activeSub && (
        <ConfirmDialog
          isOpen={isCancelDialogOpen}
          onClose={() => setIsCancelDialogOpen(false)}
          onConfirm={handleConfirmCancel}
          variant="danger"
          title="Cancelar Assinatura Recorrente?"
          description={
            <div className="space-y-2 text-left text-sm text-slate-600 dark:text-slate-300">
              <p>
                Tem certeza que deseja cancelar a assinatura do plano{' '}
                <strong className="text-slate-900 dark:text-white">{planName}</strong>?
              </p>
              <p className="text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 p-2.5 rounded-lg border border-rose-200 dark:border-rose-900/60">
                Ao cancelar, sua cobrança recorrente será suspensa imediatamente no Mercado Pago e o acesso aos recursos premium expirará ao fim do ciclo atual.
              </p>
            </div>
          }
          confirmText="Sim, Cancelar Assinatura"
          cancelText="Manter Assinatura"
          isLoading={actionLoading}
        />
      )}
    </>
  );
};
