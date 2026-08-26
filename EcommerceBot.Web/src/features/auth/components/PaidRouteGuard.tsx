/**
 * src/features/auth/components/PaidRouteGuard.tsx
 *
 * Componente de Guarda de Rota para proteger páginas funcionais e de execução de extração/robô.
 * Valida o saldo ativo de créditos do tenant (hasActiveCredits / balance_credits > 0).
 * Redireciona usuários com saldo zerado para /wallet?reason=insufficient_credits.
 */

import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth, useFeatureGate } from '@/features/auth';
import { RefreshCw } from 'lucide-react';

interface PaidRouteGuardProps {
  featureKey?: string;
  children?: React.ReactNode;
}

export const PaidRouteGuard: React.FC<PaidRouteGuardProps> = ({ featureKey = 'catalog', children }) => {
  const { user, status, isLoading } = useAuth();
  const { canAccess, isAdmin, hasActiveCredits } = useFeatureGate();

  // 1. Estado de carregamento da sessão JWT e dados da conta
  if (isLoading || status === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-slate-400">
        <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
        <span className="text-sm font-medium">Verificando saldo de créditos da carteira...</span>
      </div>
    );
  }

  // 2. Administradores possuem acesso irrestrito
  if (isAdmin) {
    return <>{children || <Outlet />}</>;
  }

  // 3. Validação de acesso ao recurso por saldo de créditos ativo (balance_credits > 0)
  if (status === 'unauthenticated' || !user || !hasActiveCredits || !canAccess(featureKey)) {
    console.warn(
      `Acesso negado ao recurso '${featureKey}': Saldo de créditos zerado. Redirecionando para /wallet?reason=insufficient_credits...`
    );
    return <Navigate to="/wallet?reason=insufficient_credits" replace />;
  }

  // 4. Usuário com saldo ativo de créditos autorizado
  return <>{children || <Outlet />}</>;
};

export default PaidRouteGuard;
