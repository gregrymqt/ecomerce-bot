/**
 * src/features/auth/hooks/useFeatureGate.ts
 *
 * Hook customizado para Feature Gating e controle de permissões por Saldo de Créditos da Carteira (Wallet).
 * Substitui as antigas checagens de nível de plano estático (pro/enterprise) pela verificação
 * reativa do saldo ativo de créditos (balance_credits > 0).
 */

import { useMemo } from 'react';
import { useAuth } from './useAuth';
import { useWallet } from '@/features/wallet/hooks/useWallet';

export type PlanType = 'free' | 'pro' | 'enterprise';

export interface FeatureGateRule {
  requiresCredits?: boolean;
  requiredRole?: 'admin';
}

export const FEATURE_RULES: Record<string, FeatureGateRule> = {
  dashboard: { requiresCredits: true },
  live_demo: { requiresCredits: false },
  catalog: { requiresCredits: true },
  shopify_export: { requiresCredits: true },
  nuvemshop_export: { requiresCredits: true },
  integrations: { requiresCredits: true },
  byok_keys: { requiresCredits: true },
  metering: { requiresCredits: true },
  wallet: { requiresCredits: false },
  sso_enterprise: { requiresCredits: true },
  admin_plans: { requiresCredits: false, requiredRole: 'admin' },
};

export function useFeatureGate() {
  const { user, currentTenant } = useAuth();
  const { balance, loadingBalance } = useWallet();

  const isAdmin = useMemo(() => {
    return Boolean(
      user && (user.is_admin === true || user.role?.toUpperCase() === 'ADMIN')
    );
  }, [user]);

  /**
   * Propriedade reativa que valida se o tenant possui saldo de créditos ativo (balance_credits > 0)
   * ou se possui privilégio de administrador do sistema.
   */
  const hasActiveCredits = useMemo(() => {
    if (isAdmin) return true;
    if (balance === null) return true; // Enquanto carrega, evita bloqueio preventivo (flash)
    return balance > 0;
  }, [isAdmin, balance]);

  /**
   * Retorna se o usuário/tenant atual possui permissão para acessar o recurso especificado.
   */
  const canAccess = (featureKey: string): boolean => {
    const rule = FEATURE_RULES[featureKey];
    if (!rule) return true;

    if (rule.requiredRole === 'admin' && !isAdmin) {
      return false;
    }

    if (rule.requiresCredits && !hasActiveCredits) {
      return false;
    }

    return true;
  };

  /**
   * Retorna se um recurso está bloqueado devido a saldo zerado ou falta de permissão.
   */
  const isFeatureLocked = (featureKey: string): boolean => {
    return !canAccess(featureKey);
  };

  /**
   * Retorna o nome formatado do status de crédito/plano ativo.
   */
  const getPlanName = (): string => {
    if (isAdmin) return 'Administrador';
    if (hasActiveCredits) return 'Carteira Ativa';
    return 'Saldo Insuficiente';
  };

  return {
    hasActiveCredits,
    balance,
    loadingBalance,
    currentTenant,
    isAdmin,
    canAccess,
    isFeatureLocked,
    getPlanName,
  };
}

export default useFeatureGate;
