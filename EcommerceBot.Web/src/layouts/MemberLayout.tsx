import React from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Zap,
  ShoppingBag,
  Wallet,
  Settings,
  LogOut,
  Bot,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { Sidebar, type SidebarNavItem } from '@/components/ui/navigation/Sidebar';
import { useAuth } from '@/features/auth';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/feedback/Badge';

export const MemberLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, currentTenant, logout } = useAuth();

  const navItems: SidebarNavItem[] = [
    {
      id: 'demo',
      label: 'Live Demo & Extração',
      icon: <Zap className="w-5 h-5 text-amber-400" />,
      active: location.pathname === '/demo' || location.pathname === '/scraper',
      onClick: () => navigate('/demo'),
    },
    {
      id: 'catalog',
      label: 'Meu Catálogo',
      icon: <ShoppingBag className="w-5 h-5 text-violet-400" />,
      badge: 'Free',
      badgeVariant: 'amber',
      active: location.pathname === '/catalog' || location.pathname === '/products',
      onClick: () => navigate('/catalog'),
    },
    {
      id: 'wallet',
      label: 'Planos & Créditos',
      icon: <Wallet className="w-5 h-5 text-emerald-400" />,
      badge: 'Upgrade',
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
      label: 'Configurações',
      icon: <Settings className="w-5 h-5" />,
      active: location.pathname === '/settings',
      onClick: () => navigate('/settings'),
    },
  ];

  return (
    <div className="flex h-screen w-full bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Sidebar do Usuário Free */}
      <Sidebar
        brand={{
          logo: <Bot className="w-6 h-6 text-amber-400" />,
          name: 'E-commerce Bot',
          description: 'Modo Degustação & Free',
        }}
        items={navItems}
        footerSlot={
          <div className="flex flex-col gap-2 p-1">
            {/* Card de Upgrade Rápido no Rodapé da Sidebar */}
            <div className="p-3 rounded-xl bg-gradient-to-br from-indigo-950/80 to-purple-950/80 border border-indigo-500/30 text-xs text-slate-200 space-y-2">
              <div className="flex items-center gap-1.5 font-bold text-white">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>Desbloqueie o Pro</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-snug">
                Integre com Shopify, Nuvemshop e IA sem limites.
              </p>
              <button
                type="button"
                onClick={() => navigate('/wallet')}
                className="w-full py-1.5 px-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-center transition-all flex items-center justify-center gap-1 cursor-pointer"
              >
                <span>Ver Planos</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {user && (
              <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800">
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
        {/* Banner de Topo com CTA de Upgrade */}
        <div className="bg-gradient-to-r from-indigo-900/60 via-purple-900/60 to-slate-900/60 border-b border-indigo-500/20 px-4 py-2 flex items-center justify-between text-xs text-indigo-200">
          <div className="flex items-center gap-2 pl-12 sm:pl-0 truncate">
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="truncate">
              Você está utilizando o <strong>Plano Free (Degustação)</strong>. Aproveite para testar a extração inteligente.
            </span>
          </div>

          <button
            type="button"
            onClick={() => navigate('/wallet')}
            className="hidden sm:inline-flex items-center gap-1 font-bold text-white hover:text-indigo-300 underline underline-offset-2 ml-4 shrink-0 cursor-pointer"
          >
            <span>Fazer Upgrade</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Header Superior */}
        <header className="sticky top-0 z-30 flex items-center justify-between pl-16 pr-4 sm:px-6 py-3.5 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 shadow-sm">
          <div className="flex items-center gap-3">
            <Badge variant="warning">
              Plano Free
            </Badge>
            {currentTenant && (
              <span className="hidden sm:inline text-xs text-slate-400 font-mono">
                Tenant: {currentTenant}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => navigate('/wallet')}
              iconLeft={<Sparkles className="w-4 h-4 text-amber-300" />}
              className="min-h-[38px] text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 cursor-pointer"
            >
              🚀 Upgrade para Pro
            </Button>
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

export default MemberLayout;
