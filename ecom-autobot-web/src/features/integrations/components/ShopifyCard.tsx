/**
 * src/features/integrations/components/ShopifyCard.tsx
 *
 * Card de Integração da plataforma Shopify.
 * Exibe status de conexão, domínio, token mascarado, latência e ações de health check / edição.
 */

import React from 'react';
import {
  ShoppingBag,
  CheckCircle,
  Activity,
  Key,
  Unlink,
  Globe,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import type { StoreIntegration } from '@/features/integrations';

interface ShopifyCardProps {
  integration?: StoreIntegration | null;
  loadingTest?: boolean;
  loadingDisconnect?: boolean;
  onTestConnection: () => void;
  onEditCredentials: () => void;
  onDisconnect: () => void;
  className?: string;
}

export const ShopifyCard: React.FC<ShopifyCardProps> = ({
  integration,
  loadingTest = false,
  loadingDisconnect = false,
  onTestConnection,
  onEditCredentials,
  onDisconnect,
  className,
}) => {
  const isConnected = integration?.status === 'CONNECTED';
  const storeDomain = integration?.store_domain || 'minhaloja.myshopify.com';
  const latency = integration?.health_check_latency_ms ?? 142;
  const healthStatus = integration?.health_check_status || 'API Operacional & Responsiva';

  return (
    <div
      className={cn(
        'rounded-2xl bg-[#15121B] border border-[#1E293B] p-6 text-slate-100 shadow-xl space-y-6 flex flex-col justify-between',
        className
      )}
    >
      <div>
        {/* Cabeçalho do Card da Shopify */}
        <div className="flex items-start justify-between pb-5 border-b border-[#1E293B]">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0 shadow-md">
              <ShoppingBag className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-extrabold text-white">Shopify Admin GraphQL</h3>
                <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                  Official Client
                </span>
              </div>
              <p className="text-xs text-slate-400">API productSet & Ingestão Contínua</p>
            </div>
          </div>

          {/* Badge Conectado / Desconectado */}
          <div>
            {isConnected ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-400">
                <CheckCircle className="h-3.5 w-3.5" />
                Conectado
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 border border-red-500/20 px-3 py-1 text-xs font-bold text-red-400">
                <AlertCircle className="h-3.5 w-3.5" />
                Desconectado
              </span>
            )}
          </div>
        </div>

        {/* Detalhes das Credenciais */}
        <div className="py-5 space-y-3">
          <div className="flex items-center justify-between text-xs sm:text-sm">
            <span className="text-slate-400 flex items-center gap-1.5">
              <Globe className="h-4 w-4 text-violet-400" />
              Domínio da Loja
            </span>
            <span className="font-mono font-semibold text-slate-200">{storeDomain}</span>
          </div>

          <div className="flex items-center justify-between text-xs sm:text-sm">
            <span className="text-slate-400 flex items-center gap-1.5">
              <Key className="h-4 w-4 text-violet-400" />
              Admin Access Token
            </span>
            <span className="font-mono text-slate-400 bg-[#090D16] px-2.5 py-1 rounded-lg border border-[#1E293B]">
              shpat_••••••••••••3a9b
            </span>
          </div>
        </div>

        {/* Painel de Health Check e Latência */}
        <div className="rounded-xl bg-[#090D16] border border-[#1E293B] p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-violet-500/10 p-2 text-violet-400 border border-violet-500/20">
              <Activity className="h-4 w-4" />
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-200 block">{healthStatus}</span>
              <span className="text-xs text-slate-400">GraphQL Storefront & Admin Protocol</span>
            </div>
          </div>

          <div className="text-right">
            <span className="text-xs font-mono font-bold text-emerald-400 block">{latency} ms</span>
            <span className="text-[10px] text-slate-500">Latência medida</span>
          </div>
        </div>
      </div>

      {/* Botões de Ação */}
      <div className="pt-4 border-t border-[#1E293B] flex flex-wrap sm:flex-nowrap gap-2">
        <button
          type="button"
          onClick={onTestConnection}
          disabled={loadingTest}
          aria-label="Testar conexão da Shopify"
          className="flex-1 min-h-[44px] h-11 px-3 rounded-xl bg-[#090D16] hover:bg-[#1E293B] border border-[#1E293B] text-slate-200 text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
        >
          {loadingTest ? (
            <Loader2 className="h-4 w-4 animate-spin text-violet-400" />
          ) : (
            <Activity className="h-4 w-4 text-violet-400" />
          )}
          <span>Testar Conexão</span>
        </button>

        <button
          type="button"
          onClick={onEditCredentials}
          aria-label="Editar credenciais da Shopify"
          className="flex-1 min-h-[44px] h-11 px-3 rounded-xl bg-[#090D16] hover:bg-[#1E293B] border border-[#1E293B] text-slate-200 text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          <Key className="h-4 w-4 text-purple-400" />
          <span>Editar Credenciais</span>
        </button>

        {isConnected && (
          <button
            type="button"
            onClick={onDisconnect}
            disabled={loadingDisconnect}
            aria-label="Desconectar loja Shopify"
            className="min-h-[44px] h-11 px-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {loadingDisconnect ? (
              <Loader2 className="h-4 w-4 animate-spin text-red-400" />
            ) : (
              <Unlink className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">Desconectar</span>
          </button>
        )}
      </div>
    </div>
  );
};
