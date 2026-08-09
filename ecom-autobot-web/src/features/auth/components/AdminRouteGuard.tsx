/**
 * src/features/auth/components/AdminRouteGuard.tsx
 * Componente de Guarda de Rota para proteger páginas exclusivas de Administradores.
 * Redireciona usuários comuns ou não autenticados para o Dashboard (/).
 */

import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/features/auth';
import { RefreshCw } from 'lucide-react';

interface AdminRouteGuardProps {
  children?: React.ReactNode;
}

export const AdminRouteGuard: React.FC<AdminRouteGuardProps> = ({ children }) => {
  const { user, status, isLoading } = useAuth();

  // 1. Estado de carregamento da sessão JWT
  if (isLoading || status === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-slate-400">
        <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
        <span className="text-sm font-medium">Verificando permissões de acesso...</span>
      </div>
    );
  }

  // 2. Validação de privilégios de administrador
  const isAdmin = Boolean(
    user && (user.is_admin === true || user.role === 'admin')
  );

  if (status === 'unauthenticated' || !user || !isAdmin) {
    console.warn('Acesso negado: Rota protegida para administradores. Redirecionando para o Dashboard...');
    return <Navigate to="/" replace />;
  }

  // 3. Usuário autorizado
  return <>{children || <Outlet />}</>;
};

export default AdminRouteGuard;
