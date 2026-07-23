import React, { useState } from 'react';
import { Bot, Sparkles, Zap, RefreshCw, ShieldCheck, CheckCircle2, ShoppingBag } from 'lucide-react';
import { LoginForm } from '../components/LoginForm';
import { RegisterForm } from '../components/RegisterForm';
import { cn } from '@/lib/utils';

export interface AuthPageProps {
  /** Modo inicial de exibição ('login' | 'register'). Padrão: 'login' */
  initialMode?: 'login' | 'register';
  /** Callback executado após login ou cadastro com sucesso */
  onSuccess?: () => void;
  /** Classes CSS adicionais para o container da página */
  className?: string;
}

export const AuthPage: React.FC<AuthPageProps> = ({
  initialMode = 'login',
  onSuccess,
  className,
}) => {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);

  return (
    <div
      className={cn(
        'min-h-screen w-full flex flex-col lg:flex-row bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-200',
        className
      )}
    >
      {/* ==========================================
          LADO ESQUERDO: Painel de Branding (Desktop SaaS Split-Screen)
          Visível em telas grandes (lg:flex), oculto em mobile
         ========================================== */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-5/12 relative overflow-hidden bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-950 p-12 flex-col justify-between border-r border-slate-800 shadow-2xl">
        {/* Glow ambient background effects */}
        <div className="absolute top-0 -left-1/4 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 -right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Topo do Painel: Logo & Badge */}
        <div className="relative z-10 space-y-4">
          <div className="inline-flex items-center gap-3 px-3.5 py-2 rounded-xl bg-white/10 dark:bg-slate-800/60 backdrop-blur-md border border-white/15 text-white shadow-lg">
            <div className="p-2 rounded-lg bg-indigo-600 text-white shadow-md">
              <Bot className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <span className="font-extrabold text-lg tracking-wide text-white">ECom-Auto-Bot</span>
              <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-500/30 text-indigo-300 border border-indigo-400/30">
                v1.0 Pro
              </span>
            </div>
          </div>
        </div>

        {/* Centro do Painel: Proposta de Valor */}
        <div className="relative z-10 my-auto py-8 space-y-8">
          <div className="space-y-4">
            <h1 className="text-3xl xl:text-4xl font-extrabold text-white leading-tight tracking-tight">
              Automação Inteligente de Catálogos de E-commerce com IA
            </h1>
            <p className="text-base xl:text-lg text-slate-300 leading-relaxed">
              Extraia, enriqueça com copywriting de conversão e sincronize milhares de produtos em instantes.
            </p>
          </div>

          {/* Destaques da Plataforma */}
          <div className="space-y-4">
            <div className="flex items-start gap-3.5 p-3.5 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 hover:bg-white/10 transition-colors">
              <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-400 shrink-0">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-semibold text-sm text-white">Extração Ultrarrápida</h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Parser híbrido com JSON-LD e fallback LLM em tempo real.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5 p-3.5 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 hover:bg-white/10 transition-colors">
              <div className="p-2 rounded-lg bg-purple-500/20 text-purple-400 shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-semibold text-sm text-white">Enriquecimento IA Persuasivo</h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Títulos magnéticos, copywriting SEO e categorização inteligente via LLMs.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5 p-3.5 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 hover:bg-white/10 transition-colors">
              <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 shrink-0">
                <RefreshCw className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-semibold text-sm text-white">Sincronização Nativa</h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Exportação e sync direto com Shopify (GraphQL) e Nuvemshop.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Rodapé do Painel: Métricas e BYOK */}
        <div className="relative z-10 pt-6 border-t border-white/10 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Segurança BYOK & Criptografia AES-256</span>
          </div>
          <div className="flex items-center gap-1.5 font-medium text-slate-300">
            <CheckCircle2 className="w-4 h-4 text-indigo-400" />
            <span>Multi-tenant Isolado</span>
          </div>
        </div>
      </div>

      {/* ==========================================
          LADO DIREITO: Container de Autenticação (Mobile & Desktop)
         ========================================== */}
      <div className="flex-1 flex flex-col justify-between p-4 sm:p-6 lg:p-12 overflow-y-auto">
        {/* Header Mobile: Exibido apenas em telas menores que lg */}
        <div className="flex lg:hidden items-center justify-between pb-6 mb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-600 text-white shadow-sm">
              <Bot className="w-5 h-5" />
            </div>
            <span className="font-extrabold text-lg text-slate-900 dark:text-slate-100">
              ECom-Auto-Bot
            </span>
          </div>
          <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-xs font-semibold border border-indigo-200 dark:border-indigo-800">
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Multi-tenant SaaS</span>
          </div>
        </div>

        {/* Formulário Centralizado */}
        <div className="my-auto w-full max-w-md mx-auto py-4 sm:py-8">
          {mode === 'login' ? (
            <LoginForm
              onSuccess={onSuccess}
              onSwitchToRegister={() => setMode('register')}
              showCard
            />
          ) : (
            <RegisterForm
              onSuccess={onSuccess}
              onSwitchToLogin={() => setMode('login')}
              showCard
            />
          )}
        </div>

        {/* Footer Geral */}
        <div className="text-center pt-6 text-xs text-slate-500 dark:text-slate-400">
          <p>© {new Date().getFullYear()} ECom-Auto-Bot. Todos os direitos reservados.</p>
        </div>
      </div>
    </div>
  );
};
