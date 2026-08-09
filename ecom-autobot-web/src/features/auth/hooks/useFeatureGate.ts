/**
 * src/features/auth/hooks/useFeatureGate.ts
 *
 * Hook customizado para Feature Gating e controle de permissões por Plano (Free, Pro, Enterprise).
 * Permite verificar acessos, obter o nome formatado do plano e identificar recursos bloqueados.
 */

import { useMemo } from 'react';
import { useAuth } from '@/features/auth';

export type PlanType = 'free' | 'pro' | 'enterprise';

export interface FeatureGateRule {
  minPlan: PlanType;
  requiredRole?: 'admin';
}

export const FEATURE_RULES: Record<string, FeatureGateRule> = {
  dashboard: { minPlan: 'pro' },
  live_demo: { minPlan: 'free' },
  catalog: { minPlan: 'pro' },
  shopify_export: { minPlan: 'pro' },
  nuvemshop_export: { minPlan: 'pro' },
  integrations: { minPlan: 'pro' },
  byok_keys: { minPlan: 'pro' },
  metering: { minPlan: 'enterprise' },
  sso_enterprise: { minPlan: 'enterprise' },
  admin_plans: { minPlan: 'free', requiredRole: 'admin' },
};

const PLAN_HIERARCHY: Record<PlanType, number> = {
  free: 1,
  pro: 2,
  enterprise: 3,
};

export function useFeatureGate() {
  const { user, currentTenant } = useAuth();

  const userPlan: PlanType = useMemo(() => {
    if (!user) return 'free';
    const rawPlan = user.plan || 'free';
    const normalized = rawPlan.toLowerCase().trim() as PlanType;
    if (normalized in PLAN_HIERARCHY) return normalized;
    return 'free';
  }, [user]);

  const isAdmin = useMemo(() => {
    return Boolean(user && (user.is_admin === true || user.role === 'admin'));
  }, [user]);

  /**
   * Retorna se o usuário/tenant atual possui acesso ao recurso especificado.
   */
  const canAccess = (featureKey: string): boolean => {
    const rule = FEATURE_RULES[featureKey];
    if (!rule) return true;

    if (rule.requiredRole === 'admin' && !isAdmin) {
      return false;
    }

    const userLevel = PLAN_HIERARCHY[userPlan] || 1;
    const requiredLevel = PLAN_HIERARCHY[rule.minPlan] || 1;

    return userLevel >= requiredLevel;
  };

  /**
   * Retorna se um recurso está bloqueado para o plano atual.
   */
  const isFeatureLocked = (featureKey: string): boolean => {
    return !canAccess(featureKey);
  };

  /**
   * Retorna o plano mínimo exigido para desbloquear uma feature.
   */
  const getRequiredPlan = (featureKey: string): PlanType => {
    return FEATURE_RULES[featureKey]?.minPlan || 'free';
  };

  /**
   * Retorna o nome exibível e formatado do plano ativo.
   */
  const getPlanName = (): string => {
    switch (userPlan) {
      case 'pro':
        return 'Plano Pro';
      case 'enterprise':
        return 'Plano Enterprise';
      case 'free':
      default:
        return 'Plano Grátis';
    }
  };

  return {
    userPlan,
    currentTenant,
    isAdmin,
    canAccess,
    isFeatureLocked,
    getRequiredPlan,
    getPlanName,
  };
}
