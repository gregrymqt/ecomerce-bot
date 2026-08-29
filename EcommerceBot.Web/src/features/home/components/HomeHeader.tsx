/**
 * src/features/home/components/HomeHeader.tsx
 *
 * Cabeçalho principal da Home com boas-vindas ao usuário, status da API e plano ativo.
 * Em conformidade com acessibilidade WCAG 2.1 AA e touch targets mínimos de 44px.
 */

import React from 'react';
import { ShieldCheck, Crown, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui';

export interface HomeHeaderProps {
  userName?: string;
  planName?: string;
  isApiOnline?: boolean;
  className?: string;
}

export const HomeHeader: React.FC<HomeHeaderProps> = ({
  userName = 'Usuário',
  planName = 'Plano Pro',
  isApiOnline = true,
  className,
}) => {
  return (
    <header
      className={cn(
        'flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-6 border-b border-slate-800/80',
        className
      )}
    >
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Bem-vindo de volta, <span className="text-purple-400">{userName}</span>
          </h1>
        </div>
        <p className="text-sm text-slate-400">
          Visão geral das automações de e-commerce, scraping e enriquecimento com IA.
        </p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        {/* Status da API */}
        <Badge
          variant={isApiOnline ? 'success' : 'error'}
          dot
          icon={<Activity className="w-3.5 h-3.5" />}
          className="min-h-[44px] px-3.5 py-2 text-xs font-medium bg-slate-900/90 dark:bg-slate-900/90"
        >
          API Status: {isApiOnline ? 'Online' : 'Offline'}
        </Badge>

        {/* Badge do Plano */}
        <Badge
          variant="purple"
          icon={<Crown className="w-4 h-4 text-purple-400" />}
          className="min-h-[44px] px-3.5 py-2 text-xs font-semibold bg-gradient-to-r from-purple-900/40 to-indigo-900/40 border-purple-500/30 text-purple-200"
        >
          <span className="flex items-center gap-1.5">
            <span>{planName}</span>
            <ShieldCheck className="w-3.5 h-3.5 text-purple-300" />
          </span>
        </Badge>
      </div>
    </header>
  );
};

export default HomeHeader;
