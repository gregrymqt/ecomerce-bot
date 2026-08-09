import React from 'react';
import { Network } from 'lucide-react';
import { AuthLeftPanel } from '@/features/auth';
import { LoginForm } from '@/features/auth';
import { RegisterForm } from '@/features/auth';
import { cn } from '@/lib/utils';
import { useAuthForm } from '@/features/auth';

export interface AuthPageProps {
  initialMode?: 'login' | 'register';
  className?: string;
}

/**
 * Página principal de Autenticação (Login / Cadastro) com layout Split-Screen SaaS.
 */
export const AuthPage: React.FC<AuthPageProps> = ({
  initialMode = 'login',
  className,
}) => {
  const {
    mode,
    setMode,
    showPassword,
    togglePasswordVisibility,
    isLoading,
    handleLogin,
    handleRegister,
  } = useAuthForm(initialMode);

  return (
    <main
      className={cn(
        'flex min-h-screen w-full relative overflow-hidden bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500 selection:text-white',
        className
      )}
    >
      {/* 1. Painel Esquerdo de Branding */}
      <AuthLeftPanel />

      {/* 2. Lado Direito: Container Central de Formulário */}
      <div className="w-full lg:w-1/2 flex flex-col justify-between p-4 sm:p-8 lg:p-12 overflow-y-auto relative z-10">
        {/* Glow de Fundo Direito */}
        <div
          className="absolute inset-0 pointer-events-none opacity-20"
          style={{
            background:
              'radial-gradient(circle at 80% 20%, rgba(99, 102, 241, 0.2) 0%, transparent 50%)',
          }}
        />

        {/* Top Spacer em Desktop */}
        <div className="hidden lg:block h-4" />

        {/* Card Glassmorphic Centralizado */}
        <div className="my-auto w-full max-w-lg mx-auto bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6 sm:p-8 shadow-2xl relative z-20">
          {/* Segmented Control (Toggle Entrar / Criar Conta) */}
          <div className="grid grid-cols-2 p-1 bg-slate-950/70 border border-slate-800 rounded-xl mb-6">
            <button
              type="button"
              onClick={() => setMode('login')}
              disabled={isLoading}
              className={cn(
                'py-2.5 text-sm font-semibold rounded-lg transition-all min-h-[44px] flex items-center justify-center cursor-pointer disabled:opacity-50',
                mode === 'login'
                  ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 shadow-sm font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              )}
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={() => setMode('register')}
              disabled={isLoading}
              className={cn(
                'py-2.5 text-sm font-semibold rounded-lg transition-all min-h-[44px] flex items-center justify-center cursor-pointer disabled:opacity-50',
                mode === 'register'
                  ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 shadow-sm font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              )}
            >
              Criar Conta
            </button>
          </div>

          {/* Renderização Condicional dos Formulários */}
          {mode === 'login' ? (
            <LoginForm
              showCard={false}
              isLoading={isLoading}
              showPassword={showPassword}
              onTogglePassword={togglePasswordVisibility}
              onSubmit={handleLogin}
              onSwitchToRegister={() => setMode('register')}
            />
          ) : (
            <RegisterForm
              showCard={false}
              isLoading={isLoading}
              showPassword={showPassword}
              onTogglePassword={togglePasswordVisibility}
              onSubmit={handleRegister}
              onSwitchToLogin={() => setMode('login')}
            />
          )}

          {/* Seção de SSO (OU CONTINUE COM) */}
          <div className="mt-6 pt-6 border-t border-slate-800/80">
            <div className="relative flex items-center justify-center mb-5">
              <span className="absolute px-3 bg-slate-900 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                OU CONTINUE COM
              </span>
              <div className="w-full border-t border-slate-800" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Botão Google */}
              <button
                type="button"
                onClick={() => console.log('[AuthPage] Login via Google iniciado')}
                disabled={isLoading}
                className="flex items-center justify-center gap-2.5 px-4 py-2.5 min-h-[44px] rounded-xl bg-slate-900 hover:bg-slate-800/80 border border-slate-800 hover:border-slate-700 text-slate-200 text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer disabled:opacity-50"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#EA4335"
                    d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.4 1 3.5 3.6 1.6 7.4l3.7 2.9C6.2 7.3 8.9 5 12 5z"
                  />
                  <path
                    fill="#4285F4"
                    d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.3 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.6 7.4C.6 9.4 0 11.6 0 14s.6 4.6 1.6 6.6l3.7-2.9-disabled:opacity-50"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3.1 0-5.8-2.3-6.7-5.3L1.6 16c1.9 3.8 5.8 7 10.4 7z"
                  />
                </svg>
                <span>Google</span>
              </button>

              {/* Botão SSO Enterprise */}
              <button
                type="button"
                onClick={() => console.log('[AuthPage] SSO Enterprise iniciado')}
                disabled={isLoading}
                className="flex items-center justify-center gap-2.5 px-4 py-2.5 min-h-[44px] rounded-xl bg-slate-900 hover:bg-slate-800/80 border border-slate-800 hover:border-slate-700 text-slate-200 text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer disabled:opacity-50"
              >
                <Network className="w-4 h-4 text-indigo-400 shrink-0" />
                <span>SSO Enterprise</span>
              </button>
            </div>
          </div>
        </div>

        {/* Rodapé com Termos e Privacidade */}
        <footer className="pt-8 pb-4 text-center text-xs text-slate-500 space-y-2 relative z-20">
          <p>© {new Date().getFullYear()} ECom-Auto-Bot. Todos os direitos reservados.</p>
          <div className="flex items-center justify-center gap-4 text-slate-400">
            <a
              href="#"
              onClick={(e) => e.preventDefault()}
              className="hover:text-indigo-400 underline-offset-4 hover:underline transition-colors"
            >
              Termos de Serviço
            </a>
            <span>•</span>
            <a
              href="#"
              onClick={(e) => e.preventDefault()}
              className="hover:text-indigo-400 underline-offset-4 hover:underline transition-colors"
            >
              Política de Privacidade
            </a>
          </div>
        </footer>
      </div>
    </main>
  );
};
