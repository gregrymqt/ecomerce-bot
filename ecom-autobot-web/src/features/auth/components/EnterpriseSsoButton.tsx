import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

export interface EnterpriseSsoButtonProps {
  /** Callback acionado ao clicar no botão */
  onClick: () => void;
  /** Texto customizado para o botão */
  text?: string;
  /** Classes CSS adicionais */
  className?: string;
}

export const EnterpriseSsoButton: React.FC<EnterpriseSsoButtonProps> = ({
  onClick,
  text = 'SSO Enterprise (Okta / SAML)',
  className,
}) => {
  return (
    <Button
      type="button"
      variant="outline"
      size="md"
      onClick={onClick}
      className={cn(
        'w-full min-h-[44px] h-11 text-sm sm:text-base font-semibold',
        'bg-slate-900/60 hover:bg-slate-800/80 text-slate-200 border-slate-700/80 hover:border-slate-600',
        'rounded-lg transition-all duration-200 shadow-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none',
        'flex items-center justify-center gap-3 cursor-pointer',
        className
      )}
      iconLeft={<ShieldCheck className="w-5 h-5 text-indigo-400 shrink-0" />}
    >
      {text}
    </Button>
  );
};
