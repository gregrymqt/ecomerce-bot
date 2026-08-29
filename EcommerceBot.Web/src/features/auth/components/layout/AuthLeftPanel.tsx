/**
 * src/features/auth/components/layout/AuthLeftPanel.tsx
 *
 * Painel de branding lateral (Esquerda) para a tela de Autenticação.
 * Exibe logo, manifesto Bento Grid com efeito glassmorphic e badge de segurança.
 */

import React from 'react';
import { Bot, Zap, Sparkles, Network, ShieldCheck } from 'lucide-react';

export interface AuthLeftPanelProps {
  className?: string;
}

export const AuthLeftPanel: React.FC<AuthLeftPanelProps> = ({ className = '' }) => {
  return (
    <div
      className={`hidden lg:flex lg:w-1/2 relative flex-col justify-between p-8 xl:p-12 overflow-hidden bg-slate-950 text-white select-none border-r border-slate-800/60 ${className}`}
    >
      {/* Efeitos de Brilho Radial Background */}
      <div
        className="absolute inset-0 pointer-events-none opacity-40"
        style={{
          background:
            'radial-gradient(circle at 15% 20%, rgba(99, 102, 241, 0.25) 0%, transparent 45%), radial-gradient(circle at 85% 75%, rgba(168, 85, 247, 0.2) 0%, transparent 45%)',
        }}
      />

      {/* Header / Logo */}
      <div className="relative z-10 flex items-center gap-3">
        <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 shadow-lg shadow-indigo-500/10">
          <Bot className="w-6 h-6 shrink-0" />
        </div>
        <div>
          <span className="text-xl font-bold tracking-wider bg-gradient-to-r from-white via-slate-100 to-indigo-200 bg-clip-text text-transparent">
            ECom-Auto-Bot
          </span>
          <p className="text-xs text-slate-400 font-medium">Plataforma de Automação e IA</p>
        </div>
      </div>

      {/* Hero Content & Bento Grid */}
      <div className="relative z-10 my-auto space-y-6 max-w-lg">
        <div className="space-y-3">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 border border-indigo-500/20 text-indigo-300">
            <Sparkles className="w-3.5 h-3.5" /> Automação Inteligente de E-commerce
          </span>
          <h1 className="text-3xl xl:text-4xl font-extrabold tracking-tight text-white leading-tight">
            Transforme catálogos brutos em vendas de alto impacto.
          </h1>
          <p className="text-sm xl:text-base text-slate-400 leading-relaxed">
            Extraia dados de e-commerce, enriqueça títulos e copy via LLM avançada e sincronize com Shopify e Nuvemshop em segundos.
          </p>
        </div>

        {/* Bento Grid Features */}
        <div className="grid grid-cols-1 gap-3.5 pt-2">
          {/* Card 1: Extração */}
          <div className="p-4 rounded-xl bg-slate-900/40 backdrop-blur-md border border-slate-800/80 hover:border-slate-700/80 transition-colors flex items-start gap-3.5">
            <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-200">Extração Automática</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Scraping inteligente de dados com suporte JSON-LD e fallback LLM markdown.
              </p>
            </div>
          </div>

          {/* Card 2: Enriquecimento */}
          <div className="p-4 rounded-xl bg-slate-900/40 backdrop-blur-md border border-slate-800/80 hover:border-slate-700/80 transition-colors flex items-start gap-3.5">
            <div className="p-2.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-200">Enriquecimento por LLM</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Geração de copy magnética, SEO otimizado e tags com DeepSeek, Groq e Gemini (BYOK).
              </p>
            </div>
          </div>

          {/* Card 3: Sincronização */}
          <div className="p-4 rounded-xl bg-slate-900/40 backdrop-blur-md border border-slate-800/80 hover:border-slate-700/80 transition-colors flex items-start gap-3.5">
            <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
              <Network className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-200">Sincronização Multi-Plataforma</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Exportação fluida e integração nativa GraphQL/REST com Shopify, Nuvemshop e CSV.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Security Badge */}
      <div className="relative z-10 pt-4">
        <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-slate-900/60 border border-slate-800 backdrop-blur-sm text-xs text-slate-300">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Criptografia AES-256 GCM & Multi-Tenant Isolado</span>
        </div>
      </div>
    </div>
  );
};

export default AuthLeftPanel;
