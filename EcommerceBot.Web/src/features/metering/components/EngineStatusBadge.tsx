/**
 * src/features/metering/components/EngineStatusBadge.tsx
 *
 * Badge de identificação do motor de inferência de IA ativo (BYOK vs SaaS Gerenciado).
 */

import React from 'react';
import { Key, Cpu } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface EngineStatusBadgeProps {
  isByokActive: boolean;
  className?: string;
}

export const EngineStatusBadge: React.FC<EngineStatusBadgeProps> = ({
  isByokActive,
  className,
}) => {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-colors shadow-xs',
        isByokActive
          ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
          : 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800',
        className
      )}
    >
      {isByokActive ? (
        <>
          <Key className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>Sua Chave OpenRouter (BYOK)</span>
        </>
      ) : (
        <>
          <Cpu className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
          <span>Infraestrutura SaaS (Créditos)</span>
        </>
      )}
    </span>
  );
};

export default EngineStatusBadge;
