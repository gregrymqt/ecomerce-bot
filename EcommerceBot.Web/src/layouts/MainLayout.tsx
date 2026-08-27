import React from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Zap, User, Bot, ShoppingBag, LogOut, ShieldCheck, Store, Settings, Activity, Wallet, TrendingUp } from 'lucide-react';
import { Sidebar, type SidebarNavItem } from '@/components/ui/navigation/Sidebar';
import { useAuth, useFeatureGate } from '@/features/auth';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/feedback/Badge';

export const MainLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, currentTenant, logout } = useAuth();
  const { isFeatureLocked, getPlanName } = useFeatureGate();

  const isAdmin = Boolean(user && (user.is_admin === true || user.role === 'admin'));
  const isDashboardLocked = isFeatureLocked('dashboard');
  const isCatalogLocked = isFeatureLocked('catalog');
  const isIntegrationsLocked = isFeatureLocked('integrations');

  const navItems: SidebarNavItem[] = [
    {
      id: 'dashboard',
      label: 'Dashboard & Telemetria',
      icon: <LayoutDashboard className="w-5 h-5" />,
      locked: isDashboardLocked,
      lockedBadge: 'CRD',
      active: location.pathname === '/' || location.pathname === '/home' || location.pathname === '/dashboard',
      onClick: () => (isDashboardLocked ? navigate('/wallet?reason=insufficient_credits') : navigate('/dashboard')),
    },
    {
      id: 'demo',
      label: 'Live Demo',
      icon: <Zap className="w-5 h-5" />,
      active: location.pathname === '/demo',
      onClick: () => navigate('/demo'),
    },
    {
      id: 'auth',
      label: 'Autenticação',
      icon: <User className="w-5 h-5" />,
      active: location.pathname === '/auth',
      onClick: () => navigate('/auth'),
    },
    {
      id: 'catalog',
      label: 'Central do Catálogo',
      icon: <ShoppingBag className="w-5 h-5" />,
      badge: isCatalogLocked ? undefined : 'Hub',
      badgeVariant: 'indigo',
      locked: isCatalogLocked,
      lockedBadge: 'CRD',
      active: location.pathname === '/catalog' || location.pathname === '/products',
      onClick: () => (isCatalogLocked ? navigate('/wallet?reason=insufficient_credits') : navigate('/catalog')),
    },
    {
      id: 'integrations',
      label: 'Central de Integrações',
      icon: <Store className="w-5 h-5" />,
      badge: isIntegrationsLocked ? undefined : 'Lojas',
      badgeVariant: 'indigo',
      locked: isIntegrationsLocked,
      lockedBadge: 'CRD',
      active: location.pathname === '/integrations' || location.pathname === '/credentials',
      onClick: () => (isIntegrationsLocked ? navigate('/wallet?reason=insufficient_credits') : navigate('/integrations')),
    },
    {
      id: 'wallet',
      label: 'Carteira & Créditos',
      icon: <Wallet className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />,
      badge: 'SaaS',
      badgeVariant: 'indigo',
      active:
        location.pathname === '/wallet' ||
        location.pathname === '/checkout' ||
        location.pathname === '/billing' ||
        location.pathname === '/plans' ||
        location.pathname === '/subscriptions',
      onClick: () => navigate('/wallet'),
    },
    {
      id: 'traffic',
      label: 'Tráfego & Anúncios',
      icon: <TrendingUp className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />,
      badge: 'Ads',
      badgeVariant: 'indigo',
      active: location.pathname === '/analytics/traffic' || location.pathname === '/traffic',
      onClick: () => navigate('/analytics/traffic'),
    },
    {
      id: 'settings',
      label: 'Configurações',
      icon: <Settings className="w-5 h-5" />,
      active: location.pathname === '/settings',
      onClick: () => navigate('/settings'),
    },
    ...(isAdmin
      ? [
          {
            id: 'admin-growth',
            label: 'Growth & CAC (Admin)',
            icon: <TrendingUp className="w-5 h-5 text-emerald-400" />,
            badge: 'SaaS',
            badgeVariant: 'indigo' as const,
            active: location.pathname === '/admin/growth',
            onClick: () => navigate('/admin/growth'),
          },
          {
            id: 'admin-plans',
            label: 'Gestão de Planos (Admin)',
            icon: <ShieldCheck className="w-5 h-5 text-indigo-400" />,
            badge: 'Admin',
            badgeVariant: 'indigo' as const,
            active: location.pathname === '/admin/plans' || location.pathname === '/plans/admin',
            onClick: () => navigate('/admin/plans'),
          },
        ]
      : []),
  ];

  return (
    <div className="flex h-screen w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden">
      {/* Sidebar Lateral */}
      <Sidebar
        brand={{
          logo: <Bot className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />,
          name: 'E-commerce Bot',
          description: 'SaaS AI Automation',
        }}
        items={navItems}
        footerSlot={
          <div className="flex flex-col gap-2 p-1">
            {currentTenant && (
              <div className="flex items-center justify-between text-xs px-2 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                <span className="font-semibold truncate">Tenant: {currentTenant}</span>
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
              </div>
            )}

            {user ? (
              <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200 dark:border-slate-800">
                <div className="min-w-0 flex-1">
                  <span className="block text-xs font-bold text-slate-900 dark:text-white truncate">
                    {user.name || user.email}
                  </span>
                  <span className="block text-[10px] text-slate-400 truncate">{user.email}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => logout()}
                  title="Sair da conta"
                  className="min-h-[36px] px-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                >
                  <LogOut className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/auth')}
                className="w-full text-xs min-h-[36px]"
              >
                Entrar / Cadastrar
              </Button>
            )}
          </div>
        }
      />

      {/* Área Principal de Conteúdo */}
      <div className="flex-1 flex flex-col h-full overflow-y-auto">
        {/* Header Superior Mobile / Desktop Context Bar */}
        <header className="sticky top-0 z-30 flex items-center justify-between pl-16 pr-4 sm:px-6 py-3.5 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-sm text-slate-700 dark:text-slate-300">
              E-commerce Automation Workspace
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Badge variant="success" icon={<Activity className="w-3.5 h-3.5" />}>
              {getPlanName()}
            </Badge>

            {currentTenant ? (
              <Badge variant="info" icon={<ShieldCheck className="w-3.5 h-3.5" />}>
                Tenant: {currentTenant}
              </Badge>
            ) : (
              <Badge variant="warning">Modo Convidado / Demo</Badge>
            )}
          </div>
        </header>

        {/* Conteúdo Renderizado da Rota Ativa */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};


