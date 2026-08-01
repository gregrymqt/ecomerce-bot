/**
 * src/features/integrations/components/NuvemshopCard.tsx
 *
 * Card de Integração com a Nuvemshop.
 * Exibe explicação do fluxo OAuth 2.0, suporte a webhooks e botão com gradiente violeta.
 */

import React from 'react';
import { Store, ShieldCheck, ExternalLink, RefreshCw, Loader2 } from 'lucide-react';
import { cn } from '@/utils/cn';

interface NuvemshopCardProps {
  loading?: boolean;
  onConnectOAuth: () => void;
  className?: string;
}

export const NuvemshopCard: React.FC<NuvemshopCardProps> = ({
  loading = false,
  onConnectOAuth,
  className,
}) => {
  return (
    <div
      className={cn(
        'rounded-2xl bg-[#15121B] border border-[#1E293B] p-6 text-slate-100 shadow-xl space-y-6 flex flex-col justify-between',
        className
      )}
    >
      <div>
        {/* Cabeçalho do Card Nuvemshop */}
        <div className="flex items-start justify-between pb-5 border-b border-[#1E293B]">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0 shadow-md">
              <Store className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-extrabold text-white">Nuvemshop API REST</h3>
                <span className="rounded-full bg-purple-500/10 border border-purple-500/20 px-2.5 py-0.5 text-[10px] font-bold text-purple-400 uppercase tracking-wider">
                  OAuth 2.0
                </span>
              </div>
              <p className="text-xs text-slate-400">Sincronização Bidirecional & Webhooks</p>
            </div>
          </div>

          <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 px-3 py-1 text-xs font-bold text-violet-300">
            <RefreshCw className="h-3.5 w-3.5 text-violet-400" />
            Webhooks Ativos
          </span>
        </div>

        {/* Explicação do Fluxo OAuth */}
        <div className="py-5 space-y-3">
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            A conexão com a Nuvemshop é realizada via autenticação segura <strong className="text-white">OAuth 2.0</strong>. Não é necessário digitar chaves manualmente.
          </p>
          <div className="rounded-xl bg-[#090D16] border border-[#1E293B] p-3.5 flex items-center gap-3 text-xs text-slate-400">
            <ShieldCheck className="h-5 w-5 text-emerald-400 shrink-0" />
            <span>
              Ao clicar no botão abaixo, você será redirecionado para autorizar o app ECom-Auto-Bot na sua loja Nuvemshop.
            </span>
          </div>
        </div>
      </div>

      {/* Botão Primário com Gradiente Violeta */}
      <div className="pt-4 border-t border-[#1E293B]">
        <button
          type="button"
          onClick={onConnectOAuth}
          disabled={loading}
          className="w-full min-h-[44px] h-12 rounded-xl bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold text-sm sm:text-base transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-violet-600/30 cursor-pointer disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Redirecionando...</span>
            </>
          ) : (
            <>
              <ExternalLink className="h-5 w-5" />
              <span>Conectar via OAuth 2.0</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
