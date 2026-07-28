import React, { useState } from 'react';
import { ShieldCheck, RefreshCw } from 'lucide-react';
import { useSubscription } from '../hooks/useSubscription';
import { ActiveSubscriptionCard } from '../components/ActiveSubscriptionCard';
import { EnterprisePromoCard } from '../components/EnterprisePromoCard';
import { PricingSection } from '../components/PricingSection';
import { InvoiceHistoryTable } from '../components/InvoiceHistoryTable';
import { CheckoutModal } from '../components/CheckoutModal';
import { Alert } from '@/components/ui/feedback/Alert';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/features/auth';
import type { PlanTier, BillingCycle } from '../types/subscription.types';

export const SubscriptionPage: React.FC = () => {
  const { currentTenant } = useAuth();
  const {
    billingStatus,
    loading,
    actionLoading,
    error,
    setError,
    refresh,
    refreshBilling,
    cancelSubscription,
  } = useSubscription();

  // Modal Checkout State
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PlanTier | null>(null);
  const [selectedCycle, setSelectedCycle] = useState<BillingCycle>('monthly');

  const handleRefreshAll = () => {
    refreshBilling();
    refresh();
  };

  const handleOpenCheckout = (plan: PlanTier, cycle: BillingCycle = 'monthly') => {
    setSelectedPlan(plan);
    setSelectedCycle(cycle);
    setIsCheckoutOpen(true);
  };

  const handleCancel = async () => {
    if (billingStatus?.subscription?.id) {
      await cancelSubscription(billingStatus.subscription.id);
    }
  };

  const handleContactEnterprise = () => {
    const enterprisePlan: PlanTier = {
      id: 'enterprise',
      name: 'Enterprise VIP',
      priceMonthly: 399,
      priceYearly: 319,
      credits: 5000,
      features: [
        'Produtos Ilimitados',
        'API Key Exclusiva com High Throughput',
        'Servidores Dedicados de Scraping',
        'Gerente de Conta Dedicado',
        'SLA Garantido de 99.9%',
      ],
    };
    handleOpenCheckout(enterprisePlan, 'yearly');
  };

  // Mapeamento do status para SubscriptionDetails
  const currentPlanId = (billingStatus?.plan_id?.toLowerCase() as 'starter' | 'pro' | 'enterprise') || 'pro';
  const hasActive = Boolean(billingStatus?.has_active_subscription);

  const activeSubscriptionDetails = {
    planName: billingStatus?.plan_id
      ? `Plano ${billingStatus.plan_id.toUpperCase()}`
      : billingStatus?.subscription?.reason || 'Plano Pro',
    priceFormatted: billingStatus?.subscription?.auto_recurring?.transaction_amount
      ? `R$ ${billingStatus.subscription.auto_recurring.transaction_amount},00`
      : 'R$ 149,00',
    status: (hasActive ? 'active' : 'canceled') as 'active' | 'canceled' | 'past_due',
    renewalDate: billingStatus?.valid_until
      ? new Date(billingStatus.valid_until).toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: 'long',
          year: 'numeric',
        })
      : '15 de Agosto, 2026',
    creditsUsed: 850,
    creditsTotal: 1000,
    resetDaysLeft: 18,
  };

  return (
    <div className="space-y-10 max-[#1400px] max-w-7xl mx-auto pb-16 px-4 sm:px-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-800 pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#8B5CF6] mb-1">
            <ShieldCheck className="h-4 w-4" />
            <span>Central de Faturamento & Assinaturas</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            Hub de Faturamento (/billing)
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Gerencie sua assinatura ativa, explore upgrade de planos e consulte recibos em PDF para o tenant{' '}
            <strong className="text-white">{currentTenant || 'padrão'}</strong>.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="md"
            className="h-11 min-h-[44px] text-sm font-semibold border-gray-800 text-gray-300 hover:text-white bg-gray-900"
            iconLeft={<RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />}
            onClick={handleRefreshAll}
            disabled={loading}
          >
            Atualizar Dados
          </Button>
        </div>
      </div>

      {/* Error Alert Display */}
      {error && (
        <Alert
          variant="error"
          title="Erro no serviço de faturamento"
          onClose={() => setError(null)}
        >
          {error}
        </Alert>
      )}

      {/* Top Section: Active Subscription (2/3) + Enterprise Promo (1/3) */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ActiveSubscriptionCard
            subscription={activeSubscriptionDetails}
            onManageCard={() => handleOpenCheckout({
              id: currentPlanId,
              name: activeSubscriptionDetails.planName,
              priceMonthly: 149,
              priceYearly: 119,
              credits: 1000,
              features: [],
            })}
            onCancelSubscription={handleCancel}
            isLoading={loading || actionLoading}
          />
        </div>

        <div className="lg:col-span-1">
          <EnterprisePromoCard onContactEnterprise={handleContactEnterprise} />
        </div>
      </section>

      {/* Middle Section: Pricing Vitrine with Cycle Toggle */}
      <section className="pt-4">
        <PricingSection
          currentPlanId={currentPlanId}
          onSelectPlan={handleOpenCheckout}
        />
      </section>

      {/* Bottom Section: Invoice History Table */}
      <section className="pt-4">
        <InvoiceHistoryTable />
      </section>

      {/* Modal: Transparent Checkout Overlay */}
      <CheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        plan={selectedPlan}
        billingCycle={selectedCycle}
        onPaymentSuccess={() => {
          refreshBilling();
          refresh();
        }}
      />
    </div>
  );
};

export default SubscriptionPage;
