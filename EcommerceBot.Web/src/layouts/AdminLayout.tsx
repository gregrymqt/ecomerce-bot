import React from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Building,
  TrendingUp,
  ShieldCheck,
  LayoutDashboard,
  Settings,
  LogOut,
  Bot,
  Store,
  Layers,
} from 'lucide-react';
import { Sidebar, type SidebarNavItem } from '@/components/ui/navigation/Sidebar';
import { useAuth } from '@/features/auth';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/feedback/Badge';

export const AdminLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, currentTenant, logout } = useAuth();

  const navItems: SidebarNavItem[] = [
    {
      id: 'admin-leads',
      label: 'Leads Enterprise (CRM)',
      icon: <Building className="w-5 h-5 text-sky-400" />,
      badge: 'CRM',
      badgeVariant: 'indigo',
      active: location.pathname === '/admin/leads',
      onClick: () => navigate('/admin/leads'),
    },
    {
      id: 'admin-growth',
      label: 'Growth & CAC',
      icon: <TrendingUp className="w-5 h-5 text-emerald-400" />,
      badge: 'SaaS',
      badgeVariant: 'indigo',
      active: location.pathname === '/admin/growth',
      onClick: () => navigate('/admin/growth'),
    },
    {
      id: 'admin-plans',
      label: 'Gestão de Planos',
      icon: <ShieldCheck className="w-5 h-5 text-indigo-400" />,
      badge: 'Admin',
      badgeVariant: 'indigo',
      active: location.pathname === '/admin/plans' || location.pathname === '/plans/admin',
      onClick: () => navigate('/admin/plans'),
    },
    {
      id: 'admin-telemetry',
      label: 'Telemetria do Sistema',
      icon: <LayoutDashboard className="w-5 h-5 text-purple-400" />,
      active: location.pathname === '/dashboard',
      onClick: () => navigate('/dashboard'),
    },
    {
      id: 'admin-settings',
      label: 'Configurações Globais',
      icon: <Settings className="w-5 h-5" />,
      active: location.pathname === '/settings',
      onClick: () => navigate('/settings'),
    },
  ];

  return (
    <div className="flex h-screen w-full bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Sidebar do Portal Admin */}
      <Sidebar
        brand={{
          logo: <Bot className="w-6 h-6 text-indigo-400" />,
          name: 'E-commerce Bot',
          description: 'Portal Admin & SaaS CRM',
        }}
        items={navItems}
        footerSlot={
          <div className="flex flex-col gap-2 p-1">
            <div className="flex items-center justify-between text-xs px-2.5 py-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 font-bold">
              <span className="flex items-center gap-1.5 truncate">
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                Super Admin Master
              </span>
            </div>

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
        {/* Header Superior do Admin */}
        <header className="sticky top-0 z-30 flex items-center justify-between pl-16 pr-4 sm:px-6 py-3.5 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 shadow-sm">
          <div className="flex items-center gap-3">
            <Badge variant="info" icon={<Layers className="w-3.5 h-3.5" />}>
              SaaS Admin Portal
            </Badge>
            {currentTenant && (
              <span className="hidden sm:inline text-xs text-slate-400 font-mono">
                Tenant: {currentTenant}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Botão de Alternância para Visão da Loja */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => navigate('/catalog')}
              iconLeft={<Store className="w-4 h-4 text-emerald-400" />}
              className="min-h-[38px] text-xs font-bold border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200 cursor-pointer"
            >
              👁️ Alternar para Visão Loja
            </Button>
          </div>
        </header>

        {/* Conteúdo da Rota */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
