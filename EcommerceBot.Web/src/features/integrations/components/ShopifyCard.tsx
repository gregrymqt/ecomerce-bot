/**
 * src/features/integrations/components/ShopifyCard.tsx
 *
 * Card de Integração da plataforma Shopify.
 * Exibe status de conexão, domínio, token mascarado, latência e ações contextuais.
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
  Plus,
  ShieldCheck,
} from 'lucide-react';
import { Card, Button, Badge } from '@/components/ui';
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
  const storeDomain = integration?.store_domain || '';
  const latency = integration?.health_check_latency_ms ?? 0;
  const healthStatus = integration?.health_check_status || 'Aguardando validação';

  return (
    <Card
      className={`bg-[#15121B] border-[#1E293B] hover:border-slate-700 transition-all text-slate-100 space-y-6 flex flex-col justify-between shadow-xl ${
        className || ''
      }`}
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
                <Badge variant="success">2024-01+</Badge>
              </div>
              <p className="text-xs text-slate-400">Mutations productCreate & Sincronização em Lote</p>
            </div>
          </div>

          {/* Badge Conectado / Desconectado */}
          <div>
            {isConnected ? (
              <Badge variant="success" dot className="px-3 py-1 font-semibold">
                <CheckCircle className="h-3.5 w-3.5 mr-1" />
                Conectado
              </Badge>
            ) : (
              <Badge variant="error" dot className="px-3 py-1 font-semibold">
                <AlertCircle className="h-3.5 w-3.5 mr-1" />
                Desconectado
              </Badge>
            )}
          </div>
        </div>

        {/* Conteúdo Dinâmico por Estado */}
        {isConnected ? (
          <div className="py-5 space-y-4">
            {/* Detalhes das Credenciais */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs sm:text-sm">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Globe className="h-4 w-4 text-emerald-400" />
                  Domínio da Loja
                </span>
                <span className="font-mono font-bold text-white bg-slate-900/80 px-2.5 py-1 rounded-lg border border-slate-800">
                  {storeDomain}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs sm:text-sm">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Key className="h-4 w-4 text-violet-400" />
                  Admin Access Token
                </span>
                <span className="font-mono text-slate-400 bg-[#090D16] px-2.5 py-1 rounded-lg border border-[#1E293B]">
                  shpat_••••••••••••••••
                </span>
              </div>
            </div>

            {/* Painel de Health Check e Latência */}
            <div className="rounded-xl bg-[#090D16] border border-[#1E293B] p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-400 border border-emerald-500/20">
                  <Activity className="h-4 w-4" />
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-200 block">{healthStatus}</span>
                  <span className="text-[11px] text-slate-400">GraphQL Admin Protocol</span>
                </div>
              </div>

              <div className="text-right">
                <span className="text-xs font-mono font-bold text-emerald-400 block">{latency} ms</span>
                <span className="text-[10px] text-slate-500">Latência medida</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="py-6 space-y-3.5 text-center sm:text-left">
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Conecte sua loja Shopify para catalogar produtos com IA, sincronizar variações, preços e atualizar estoques automaticamente via Webhooks.
            </p>
            <div className="rounded-xl bg-[#090D16] border border-[#1E293B] p-3 flex items-center gap-2.5 text-xs text-slate-400">
              <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
              <span>Token privado criptografado com chave mestra AES-256 GCM (BYOK).</span>
            </div>
          </div>
        )}
      </div>

      {/* Botões de Ação */}
      <div className="pt-4 border-t border-[#1E293B]">
        {isConnected ? (
          <div className="flex flex-wrap sm:flex-nowrap gap-2">
            <Button
              variant="secondary"
              onClick={onTestConnection}
              disabled={loadingTest}
              aria-label="Testar conexão da Shopify"
              iconLeft={
                loadingTest ? (
                  <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
                ) : (
                  <Activity className="h-4 w-4 text-emerald-400" />
                )
              }
              className="flex-1 min-h-[44px]"
            >
              Testar Conexão
            </Button>

            <Button
              variant="secondary"
              onClick={onEditCredentials}
              aria-label="Editar credenciais da Shopify"
              iconLeft={<Key className="h-4 w-4 text-purple-400" />}
              className="flex-1 min-h-[44px]"
            >
              Editar Token
            </Button>

            <Button
              variant="danger"
              onClick={onDisconnect}
              disabled={loadingDisconnect}
              aria-label="Desconectar loja Shopify"
              iconLeft={
                loadingDisconnect ? (
                  <Loader2 className="h-4 w-4 animate-spin text-red-400" />
                ) : (
                  <Unlink className="h-4 w-4" />
                )
              }
              className="min-h-[44px]"
            >
              <span className="hidden sm:inline">Desconectar</span>
            </Button>
          </div>
        ) : (
          <Button
            variant="primary"
            onClick={onEditCredentials}
            iconLeft={<Plus className="h-4 w-4" />}
            className="w-full h-12 bg-emerald-600 hover:bg-emerald-500 font-bold shadow-lg shadow-emerald-600/20 text-white min-h-[44px]"
          >
            Conectar Loja Shopify
          </Button>
        )}
      </div>
    </Card>
  );
};
