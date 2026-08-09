import { useState, useEffect } from 'react';
import { subscriptionService, type BillingCycle, type PlanTier } from '@/features/subscription';

export interface UsePricingSectionOptions {
  onSelectPlan?: (plan: PlanTier, cycle: BillingCycle) => void;
}

export function usePricingSection(options?: UsePricingSectionOptions) {
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [remotePlans, setRemotePlans] = useState<PlanTier[] | null>(null);

  useEffect(() => {
    let isMounted = true;
    setLoadingPlans(true);

    subscriptionService
      .getPublicPlans()
      .then((data) => {
        if (!isMounted) return;
        if (Array.isArray(data) && data.length > 0) {
          const mapped: PlanTier[] = data.map((p) => ({
            id: ((p.id || 'pro').toLowerCase() as PlanTier['id']),
            name: p.reason || 'Plano',
            priceMonthly: p.auto_recurring?.transaction_amount || 149,
            priceYearly: Math.round((p.auto_recurring?.transaction_amount || 149) * 0.8),
            credits: 1000,
            features: [
              'Enriquecimento com IA via DeepSeek & Groq',
              'Sincronização com Shopify & Nuvemshop',
              'Exportação ilimitada em CSV/JSON',
            ],
            isPopular: p.id === 'pro' || p.reason?.toLowerCase().includes('pro'),
          }));
          setRemotePlans(mapped);
        }
      })
      .catch(() => {
        // Fallback silencioso para lista estática padrão
      })
      .finally(() => {
        if (isMounted) setLoadingPlans(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handlePlanClick = (plan: PlanTier) => {
    if (options?.onSelectPlan) {
      options.onSelectPlan(plan, billingCycle);
    }
  };

  return {
    billingCycle,
    setBillingCycle,
    loadingPlans,
    remotePlans,
    handlePlanClick,
  };
}
