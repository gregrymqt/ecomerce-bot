import React from 'react';
import {
  ShieldCheck,
  RefreshCw,
  CreditCard,
  History,
  Sparkles,
  Layers,
  CalendarCheck,
} from 'lucide-react';
import { useSubscription } from '../hooks/useSubscription';
import { SubscriptionBillingCard } from '../components/SubscriptionBillingCard';
import { SubscriptionHistoryTable } from '../components/SubscriptionHistoryTable';
import { StatCard } from '@/components/ui/display/StatCard';
import { Alert } from '@/components/ui/feedback/Alert';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/features/auth';

export const SubscriptionPage: React.FC = () => {
  const { currentTenant } = useAuth();
  const {
    billingStatus,
    subscriptions,
    total,
    page,
    setPage,
    statusFilter,
    setStatusFilter,
    loading,
    actionLoading,
    error,
    setError,
    refresh,
    refreshBilling,
    cancelSubscription,
    syncSubscription,
    exportCsv,
  } = useSubscription();

  const handleRefreshAll = () => {
    refreshBilling();
    refresh();
  };

  const handleCancel = async (id: string) => {
    await cancelSubscription(id);
  };

  const handleSync = async (id: string) => {
    await syncSubscription(id);
  };

  // Métricas para StatCards superiores
  const hasActive = Boolean(billingStatus?.has_active_subscription);
  const activePlanName = billingStatus?.plan_id
    ? billingStatus.plan_id.toUpperCase()
    : billingStatus?.subscription?.reason || (hasActive ? 'ATIVO' : 'NENHUM');

  const validUntilFormatted = billingStatus?.valid_until
    ? new Date(billingStatus.valid_until).toLocaleDateString('pt-BR')
    : '-';

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Cabeçalho da Página */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 mb-1">
            <ShieldCheck className="w-4 h-4" />
            <span>Gestão de Planos & Mercado Pago</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            Assinaturas & Faturamento
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Gerencie seu plano recorrente, acompanhe o status no Mercado Pago e exporte relatórios do tenant{' '}
            <strong className="text-slate-800 dark:text-slate-200">{currentTenant || 'padrão'}</strong>.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-center">
          <Button
            type="button"
            variant="outline"
            size="md"
            className="h-11 min-h-[44px] text-sm font-semibold border-slate-300 dark:border-slate-700"
            iconLeft={<RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />}
            onClick={handleRefreshAll}
            disabled={loading}
          >
            Atualizar Dados
          </Button>
        </div>
      </div>

      {/* Exibição de Alerta de Erro se houver */}
      {error && (
        <Alert
          variant="error"
          title="Ocorreu um erro no módulo de assinaturas"
          onClose={() => setError(null)}
          className="animate-fade-in"
        >
          {error}
        </Alert>
      )}

      {/* Cards Estatísticos de Resumo Rápido */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        <StatCard
          title="Status da Conta"
          value={hasActive ? 'Assinatura Ativa' : 'Plano Gratuito / Inativo'}
          description={hasActive ? `Plano ${activePlanName}` : 'Sem cobrança recorrente'}
          icon={<CreditCard className="w-5 h-5" />}
          trend={hasActive ? { value: 'Regular', isPositive: true } : undefined}
        />

        <StatCard
          title="Próxima Fatura"
          value={validUntilFormatted}
          description="Validade da renovação recorrente"
          icon={<CalendarCheck className="w-5 h-5" />}
        />

        <StatCard
          title="Histórico de Assinaturas"
          value={total}
          description="Registros no Mercado Pago"
          icon={<Layers className="w-5 h-5" />}
        />
      </div>

      {/* Card Principal de Status e Ações da Assinatura Ativa */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
          <Sparkles className="w-4 h-4 text-indigo-500" />
          <h2>Assinatura Atual</h2>
        </div>

        <SubscriptionBillingCard
          billingStatus={billingStatus}
          loading={loading && !billingStatus}
          actionLoading={actionLoading}
          onCancelSubscription={handleCancel}
        />
      </section>

      {/* Tabela de Histórico de Assinaturas */}
      <section className="space-y-4 pt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
            <History className="w-4 h-4 text-indigo-500" />
            <h2>Histórico Completo do Tenant</h2>
          </div>
        </div>

        <SubscriptionHistoryTable
          subscriptions={subscriptions}
          total={total}
          page={page}
          limit={10}
          onPageChange={setPage}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          loading={loading}
          actionLoading={actionLoading}
          onExportCsv={exportCsv}
          onSyncSubscription={handleSync}
          onCancelSubscription={handleCancel}
        />
      </section>
    </div>
  );
};

export default SubscriptionPage;
