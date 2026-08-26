/**
 * src/features/auth/components/ProtectedRoute.tsx
 * Componente de Guarda de Rota para proteger páginas privadas da aplicação.
 * Redireciona usuários não autenticados para a tela de login (/auth).
 */

import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/features/auth';
import { RefreshCw } from 'lucide-react';

interface ProtectedRouteProps {
  children?: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, isAuthenticated, status, isLoading } = useAuth();
  const location = useLocation();

  // 1. Exibe tela/spinner de carregamento enquanto a sessão é validada pelo backend
  if (isLoading || status === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-slate-400">
        <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
        <span className="text-sm font-medium">Verificando autenticação...</span>
      </div>
    );
  }

  // 2. Redireciona usuários não autenticados para /auth preservando a origem no state
  if (!isAuthenticated || !user) {
    return <Navigate to="/auth" replace state={{ from: location }} />;
  }

  // 3. Usuário autenticado: Renderiza filhos ou Outlet das rotas aninhadas
  return <>{children || <Outlet />}</>;
};

export default ProtectedRoute;
