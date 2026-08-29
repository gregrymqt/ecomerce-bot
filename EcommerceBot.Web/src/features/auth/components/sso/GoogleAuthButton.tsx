/**
 * src/features/auth/components/sso/GoogleAuthButton.tsx
 *
 * Botão para acionar o fluxo de OAuth 2.0 com Google.
 */

import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

export interface GoogleAuthButtonProps {
  /** Texto a ser exibido no botão */
  text?: string;
  /** Nome da organização/tenant opcional para cadastro */
  tenantName?: string;
  /** Estado de carregamento customizado */
  isLoading?: boolean;
  /** Callback acionado ao clicar no botão */
  onClick?: () => void;
  /** Classes CSS adicionais para o botão */
  className?: string;
}

export const GoogleAuthButton: React.FC<GoogleAuthButtonProps> = ({
  text = 'Continuar com o Google',
  tenantName,
  isLoading: propsIsLoading,
  onClick,
  className,
}) => {
  const { initiateGoogleLogin, isLoading: authIsLoading } = useAuth();
  const [internalLoading, setInternalLoading] = useState(false);

  const isLoading = propsIsLoading ?? authIsLoading ?? internalLoading;

  const handleClick = async () => {
    if (onClick) {
      onClick();
      return;
    }

    try {
      setInternalLoading(true);
      await initiateGoogleLogin(tenantName);
    } catch (err) {
      console.error('[GoogleAuthButton] Falha ao iniciar OAuth:', err);
    } finally {
      setInternalLoading(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="md"
      isLoading={isLoading}
      onClick={handleClick}
      disabled={isLoading}
      className={cn(
        'w-full min-h-[44px] h-11 text-sm sm:text-base font-semibold',
        'bg-slate-900/80 hover:bg-slate-800/90 text-slate-100 border-slate-700/80 hover:border-slate-600',
        'rounded-lg transition-all duration-200 shadow-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none',
        'flex items-center justify-center gap-3 cursor-pointer',
        className
      )}
      iconLeft={
        !isLoading ? (
          <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
        ) : undefined
      }
    >
      {isLoading ? 'Conectando ao Google...' : text}
    </Button>
  );
};

export default GoogleAuthButton;
