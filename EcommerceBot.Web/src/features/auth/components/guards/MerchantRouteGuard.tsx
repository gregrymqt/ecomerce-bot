/**
 * src/features/auth/components/guards/MerchantRouteGuard.tsx
 *
 * Guarda de Rota para recursos do portal da loja (/dashboard, /integrations, /metering, etc.).
 * Alinhado com o modelo canônico de Pacotes de Recarga (Ledger Pattern):
 * - Não bloqueia nem ejeta usuários com 403.
 * - Permite navegação irrestrita para todos os lojistas autenticados.
 * - Quando o saldo de créditos for zero, exibe um banner de aviso suave no topo
 *   alertando sobre a pausa das rotas de IA e oferecendo CTA para /wallet.
 */

import React from 'react';
import { Navigate, Outlet, Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useFeatureGate } from '../../hooks/useFeatureGate';
import { RefreshCw, AlertTriangle, Zap } from 'lucide-react';

interface MerchantRouteGuardProps {
  featureKey?: string;
  children?: React.ReactNode;
}

export const MerchantRouteGuard: React.FC<MerchantRouteGuardProps> = ({
  children,
}) => {
  const { user, status, isLoading } = useAuth();
  const { isAdmin, hasActiveCredits } = useFeatureGate();

  // 1. Estado de carregamento da sessão JWT e dados da conta
  if (isLoading || status === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-slate-400">
        <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
        <span className="text-sm font-medium">Verificando permissões de lojista...</span>
      </div>
    );
  }

  // 2. Não autenticado -> Redireciona para Tela de Login
  if (status === 'unauthenticated' || !user) {
    return <Navigate to="/auth" replace />;
  }

  // 3. Super Administradores possuem acesso irrestrito
  if (isAdmin) {
    return <>{children || <Outlet />}</>;
  }

  // 4. Se saldo estiver zerado, exibe aviso suave sem bloquear a tela
  if (!hasActiveCredits) {
    return (
      <>
        <div
          role="status"
          aria-live="polite"
          className="w-full bg-amber-500/15 border-b border-amber-500/30 px-4 py-2.5 text-amber-200 animate-fade-in sticky top-0 z-40 backdrop-blur-md"
        >
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs sm:text-sm font-medium">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                Seu saldo de créditos está zerado. As rotas de inteligência artificial estão pausadas.
              </span>
            </div>
            <Link
              to="/wallet"
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs transition-colors shrink-0 min-h-[32px]"
            >
              <Zap className="w-3.5 h-3.5 fill-current" />
              Recarregar Agora
            </Link>
          </div>
        </div>
        {children || <Outlet />}
      </>
    );
  }

  // 5. Autorizado com créditos ativos
  return <>{children || <Outlet />}</>;
};

export default MerchantRouteGuard;
