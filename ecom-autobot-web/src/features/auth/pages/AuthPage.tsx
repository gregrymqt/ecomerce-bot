import React from 'react';
import { AuthLeftPanel } from '@/features/auth';
import { LoginForm } from '@/features/auth';
import { RegisterForm } from '@/features/auth';
import { cn } from '@/lib/utils';
import { useAuthForm } from '@/features/auth';
import { SEO } from '@/components/common/SEO';

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
      <SEO
        title={mode === 'login' ? 'Entrar na Conta' : 'Criar Nova Conta'}
        description="Acesse ou crie sua conta na plataforma E-Commerce AutoBot para automatizar e enriquecer seus catálogos de e-commerce com IA."
      />
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
          {/* Segmented Control (Toggle Entrar / Criar Conta com A11y role=tablist) */}
          <div role="tablist" aria-label="Modo de autenticação" className="grid grid-cols-2 p-1 bg-slate-950/70 border border-slate-800 rounded-xl mb-6">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'login'}
              onClick={() => setMode('login')}
              disabled={isLoading}
              className={cn(
                'py-2.5 text-sm font-semibold rounded-lg transition-all min-h-[44px] flex items-center justify-center cursor-pointer disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none',
                mode === 'login'
                  ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 shadow-sm font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              )}
            >
              Entrar
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'register'}
              onClick={() => setMode('register')}
              disabled={isLoading}
              className={cn(
                'py-2.5 text-sm font-semibold rounded-lg transition-all min-h-[44px] flex items-center justify-center cursor-pointer disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none',
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

export default AuthPage;
