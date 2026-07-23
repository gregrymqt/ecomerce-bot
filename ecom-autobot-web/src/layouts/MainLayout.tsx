import React from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Zap, User, Bot, ShoppingBag, LogOut, ShieldCheck } from 'lucide-react';
import { Sidebar, type SidebarNavItem } from '@/components/ui/navigation/Sidebar';
import { useAuth } from '@/features/auth';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/feedback/Badge';

export const MainLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, currentTenant, logout } = useAuth();

  const navItems: SidebarNavItem[] = [
    {
      id: 'demo',
      label: 'Live Demo',
      icon: <Zap className="w-5 h-5" />,
      active: location.pathname === '/demo' || location.pathname === '/',
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
      id: 'products',
      label: 'Catálogo de Produtos',
      icon: <ShoppingBag className="w-5 h-5" />,
      badge: 'Pro',
      badgeVariant: 'indigo',
      active: location.pathname === '/products',
      onClick: () => navigate('/demo'),
    },
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
        <header className="sticky top-0 z-30 flex items-center justify-between px-6 py-3.5 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-sm text-slate-700 dark:text-slate-300">
              E-commerce Automation Workspace
            </span>
          </div>

          <div className="flex items-center gap-3">
            {currentTenant ? (
              <Badge variant="indigo" icon={<ShieldCheck className="w-3.5 h-3.5" />}>
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
