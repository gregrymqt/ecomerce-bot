/**
 * src/layouts/hooks/useRoleLayout.ts
 *
 * Hook customizado para resolução reativa do layout ativo da aplicação.
 * Garante segregação estrita entre MemberLayout, MerchantLayout e AdminLayout,
 * impedindo vazamento de sidebar e permitindo ao Super Admin alternar entre
 * o CRM Administrativo e a Visão Loja.
 */

import { useState, useCallback, useMemo } from 'react';
import { useAuth } from '@/features/auth';

export type RoleLayoutType = 'admin' | 'merchant' | 'member';
export type AdminViewMode = 'crm' | 'store';

const ADMIN_VIEW_STORAGE_KEY = 'ecommercebot_admin_portal_view';

const MERCHANT_ROLES = new Set(['TENANT_ADMIN', 'CATALOG_OPERATOR', 'MERCHANT', 'OWNER']);

export function useRoleLayout() {
  const { user, status, isLoading } = useAuth();

  // 1. Estado sincronizado com sessionStorage para alternância de visão do Super Admin
  const [adminViewMode, setAdminViewModeState] = useState<AdminViewMode>(() => {
    try {
      const stored = sessionStorage.getItem(ADMIN_VIEW_STORAGE_KEY);
      return stored === 'store' ? 'store' : 'crm';
    } catch {
      return 'crm';
    }
  });

  const setAdminViewMode = useCallback((mode: AdminViewMode) => {
    setAdminViewModeState(mode);
    try {
      sessionStorage.setItem(ADMIN_VIEW_STORAGE_KEY, mode);
    } catch (e) {
      console.warn('Falha ao persistir adminViewMode no sessionStorage:', e);
    }
  }, []);

  const toggleAdminViewMode = useCallback(() => {
    setAdminViewMode(adminViewMode === 'crm' ? 'store' : 'crm');
  }, [adminViewMode, setAdminViewMode]);

  // 2. Classificação de privilégios de acesso
  const isAdmin = useMemo(() => {
    return Boolean(
      user && (user.is_admin === true || user.role?.toUpperCase() === 'ADMIN')
    );
  }, [user]);

  const isMerchant = useMemo(() => {
    if (isAdmin) return true;
    if (!user) return false;

    const plan = user.plan?.toLowerCase();
    if (plan === 'pro' || plan === 'enterprise') return true;

    const role = user.role?.toUpperCase() || '';
    return MERCHANT_ROLES.has(role);
  }, [user, isAdmin]);

  const isMember = useMemo(() => {
    return !isAdmin && !isMerchant;
  }, [isAdmin, isMerchant]);

  // 3. Resolução estrita do Layout Ativo
  const resolvedLayout = useMemo<RoleLayoutType>(() => {
    if (isAdmin) {
      return adminViewMode === 'store' ? 'merchant' : 'admin';
    }

    if (isMerchant) {
      return 'merchant';
    }

    return 'member';
  }, [isAdmin, isMerchant, adminViewMode]);

  return {
    resolvedLayout,
    adminViewMode,
    setAdminViewMode,
    toggleAdminViewMode,
    isAdmin,
    isMerchant,
    isMember,
    isLoading: isLoading || status === 'loading',
  };
}

export default useRoleLayout;
