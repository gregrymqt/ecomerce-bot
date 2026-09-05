/**
 * src/features/auth/components/guards/MerchantRouteGuard.tsx
 *
 * Guarda de Rota para proteção estrita de recursos e páginas exclusivas de Lojistas.
 * Impede que usuários com perfil Member/Free acessem páginas restritas da loja
 * (/dashboard, /integrations, /metering, /analytics/traffic).
 * Redireciona usuários sem privilégio de lojista para /wallet?reason=upgrade_required,
 * garantindo que permaneçam no fluxo seguro do MemberLayout.
 */

import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useFeatureGate } from '../../hooks/useFeatureGate';
import { RefreshCw } from 'lucide-react';

const MERCHANT_ROLES = new Set(['TENANT_ADMIN', 'CATALOG_OPERATOR', 'MERCHANT', 'OWNER']);

interface MerchantRouteGuardProps {
  featureKey?: string;
  children?: React.ReactNode;
}

export const MerchantRouteGuard: React.FC<MerchantRouteGuardProps> = ({
  featureKey = 'dashboard',
  children,
}) => {
  const { user, status, isLoading } = useAuth();
  const { canAccess, isAdmin, hasActiveCredits } = useFeatureGate();

  // 1. Estado de carregamento da sessão JWT e dados da conta
  if (isLoading || status === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-slate-400">
        <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
        <span className="text-sm font-medium">Verificando permissões de lojista...</span>
      </div>
    );
  }

  // 2. Não autenticado -> Tela de Login
  if (status === 'unauthenticated' || !user) {
    return <Navigate to="/auth" replace />;
  }

  // 3. Super Administradores possuem acesso irrestrito
  if (isAdmin) {
    return <>{children || <Outlet />}</>;
  }

  // 4. Validação de perfil de Lojista (Plano Pro/Enterprise ou Role Canônica)
  const isMerchantUser = (() => {
    const plan = user.plan?.toLowerCase();
    if (plan === 'pro' || plan === 'enterprise') return true;

    const role = user.role?.toUpperCase() || '';
    return MERCHANT_ROLES.has(role);
  })();

  if (!isMerchantUser) {
    console.warn(
      `Acesso negado à rota de lojista '${featureKey}': Usuário com perfil '${user.role || 'MEMBER'}' e plano '${user.plan || 'free'}'. Redirecionando para /wallet...`
    );
    return <Navigate to="/wallet?reason=upgrade_required" replace />;
  }

  // 5. Validação de saldo de créditos ou feature gate quando aplicável
  if (!hasActiveCredits || !canAccess(featureKey)) {
    console.warn(
      `Acesso negado ao recurso '${featureKey}': Saldo insuficiente. Redirecionando para /wallet...`
    );
    return <Navigate to="/wallet?reason=insufficient_credits" replace />;
  }

  // 6. Autorizado
  return <>{children || <Outlet />}</>;
};

export default MerchantRouteGuard;
