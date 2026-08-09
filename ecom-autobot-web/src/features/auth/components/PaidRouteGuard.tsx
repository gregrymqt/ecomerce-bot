/**
 * src/features/auth/components/PaidRouteGuard.tsx
 * Componente de Guarda de Rota para proteger páginas exclusivas de Usuários Pagantes (Pro / Enterprise).
 * Redireciona usuários do plano Gratuito (free) para a Vitrine de Planos (/billing).
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
  const { canAccess, isAdmin } = useFeatureGate();

  // 1. Estado de carregamento da sessão JWT
  if (isLoading || status === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-slate-400">
        <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
        <span className="text-sm font-medium">Verificando plano de assinatura...</span>
      </div>
    );
  }

  // 2. Administradores possuem acesso irrestrito
  if (isAdmin) {
    return <>{children || <Outlet />}</>;
  }

  // 3. Validação de acesso ao recurso por nível de plano
  const isAllowed = canAccess(featureKey);

  if (status === 'unauthenticated' || !user || !isAllowed) {
    console.warn(`Acesso negado ao recurso '${featureKey}': Requer plano Pro ou Enterprise. Redirecionando para /billing...`);
    return <Navigate to="/billing" replace />;
  }

  // 4. Usuário pagante autorizado
  return <>{children || <Outlet />}</>;
};

export default PaidRouteGuard;
