import React from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  ShoppingBag,
  Store,
  TrendingUp,
  Activity,
  Wallet,
  Settings,
  LogOut,
  Bot,
  ShieldCheck,
  Building,
} from 'lucide-react';
import { Sidebar, type SidebarNavItem } from '@/components/ui/navigation/Sidebar';
import { useAuth, useFeatureGate } from '@/features/auth';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/feedback/Badge';

export const MerchantLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, currentTenant, logout } = useAuth();
  const { getPlanName } = useFeatureGate();

  const isAdmin = Boolean(user && (user.is_admin === true || user.role === 'admin' || user.role === 'ADMIN'));

  const navItems: SidebarNavItem[] = [
    {
      id: 'dashboard',
      label: 'Dashboard & Telemetria',
      icon: <LayoutDashboard className="w-5 h-5 text-indigo-400" />,
      active: location.pathname === '/dashboard' || location.pathname === '/home',
      onClick: () => navigate('/dashboard'),
    },
    {
      id: 'catalog',
      label: 'Central do Catálogo',
      icon: <ShoppingBag className="w-5 h-5 text-violet-400" />,
      badge: 'Hub',
      badgeVariant: 'indigo',
      active: location.pathname === '/catalog' || location.pathname === '/products',
      onClick: () => navigate('/catalog'),
    },
    {
      id: 'integrations',
      label: 'Central de Integrações',
      icon: <Store className="w-5 h-5 text-sky-400" />,
      badge: 'Lojas',
      badgeVariant: 'indigo',
      active: location.pathname === '/integrations' || location.pathname === '/credentials',
      onClick: () => navigate('/integrations'),
    },
    {
      id: 'traffic',
      label: 'Tráfego, Ads & ML',
      icon: <TrendingUp className="w-5 h-5 text-emerald-400" />,
      badge: 'IA',
      badgeVariant: 'indigo',
      active: location.pathname === '/analytics/traffic' || location.pathname === '/traffic',
      onClick: () => navigate('/analytics/traffic'),
    },
    {
      id: 'metering',
      label: 'Consumo & BYOK',
      icon: <Activity className="w-5 h-5 text-purple-400" />,
      active: location.pathname === '/metering' || location.pathname === '/billing/metering',
      onClick: () => navigate('/metering'),
    },
    {
      id: 'wallet',
      label: 'Carteira & Créditos',
      icon: <Wallet className="w-5 h-5 text-indigo-400" />,
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
      id: 'settings',
      label: 'Configurações da Loja',
      icon: <Settings className="w-5 h-5" />,
      active: location.pathname === '/settings',
      onClick: () => navigate('/settings'),
    },
  ];

  return (
    <div className="flex h-screen w-full bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Sidebar do Lojista */}
      <Sidebar
        brand={{
          logo: <Bot className="w-6 h-6 text-indigo-400" />,
          name: 'E-commerce Bot',
          description: 'Gestão de E-commerce & IA',
        }}
        items={navItems}
        footerSlot={
          <div className="flex flex-col gap-2 p-1">
            {currentTenant && (
              <div className="flex items-center justify-between text-xs px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300">
                <span className="font-semibold truncate">Loja: {currentTenant}</span>
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              </div>
            )}

            {user && (
              <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800">
                <div className="min-w-0 flex-1">
                  <span className="block text-xs font-bold text-white truncate">
                    {user.name || user.email}
                  </span>
                  <span className="block text-[10px] text-slate-400 truncate">{user.email}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => logout()}
                  title="Sair da conta"
                  className="min-h-[36px] px-2 text-rose-400 hover:bg-rose-950/30"
                >
                  <LogOut className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        }
      />

      {/* Área Principal */}
      <div className="flex-1 flex flex-col h-full overflow-y-auto">
        {/* Header Superior do Lojista */}
        <header className="sticky top-0 z-30 flex items-center justify-between pl-16 pr-4 sm:px-6 py-3.5 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="font-bold text-sm text-white">
              Painel do Lojista
            </span>
            <Badge variant="success" icon={<Activity className="w-3.5 h-3.5" />}>
              {getPlanName()}
            </Badge>
          </div>

          <div className="flex items-center gap-3">
            {/* Se o usuário for Admin visualizando como lojista, exibe atalho de retorno ao CRM */}
            {isAdmin && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => navigate('/admin/leads')}
                iconLeft={<Building className="w-4 h-4 text-sky-400" />}
                className="min-h-[38px] text-xs font-bold border-indigo-500/30 bg-indigo-950/40 hover:bg-indigo-900/60 text-indigo-300 cursor-pointer"
              >
                🛡️ Voltar ao Admin CRM
              </Button>
            )}

            {currentTenant ? (
              <Badge variant="info" icon={<ShieldCheck className="w-3.5 h-3.5" />}>
                Tenant: {currentTenant}
              </Badge>
            ) : (
              <Badge variant="warning">Tenant Padrão</Badge>
            )}
          </div>
        </header>

        {/* Conteúdo Renderizado */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default MerchantLayout;
