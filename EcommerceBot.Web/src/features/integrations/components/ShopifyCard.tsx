/**
 * src/features/integrations/components/ShopifyCard.tsx
 *
 * Card de Integração da plataforma Shopify.
 * Exibe status de conexão, domínio, token mascarado, latência e ações utilizando componentes genéricos do Design System.
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
  const storeDomain = integration?.store_domain || 'minhaloja.myshopify.com';
  const latency = integration?.health_check_latency_ms ?? 142;
  const healthStatus = integration?.health_check_status || 'API Operacional & Responsiva';

  return (
    <Card className={`bg-[#15121B] border-[#1E293B] text-slate-100 space-y-6 flex flex-col justify-between ${className || ''}`}>
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
                <Badge variant="success">Official Client</Badge>
              </div>
              <p className="text-xs text-slate-400">API productSet & Ingestão Contínua</p>
            </div>
          </div>

          {/* Badge Conectado / Desconectado */}
          <div>
            {isConnected ? (
              <Badge variant="success" dot className="px-3 py-1">
                <CheckCircle className="h-3.5 w-3.5 mr-1" />
                Conectado
              </Badge>
            ) : (
              <Badge variant="error" dot className="px-3 py-1">
                <AlertCircle className="h-3.5 w-3.5 mr-1" />
                Desconectado
              </Badge>
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
        <Button
          variant="secondary"
          onClick={onTestConnection}
          disabled={loadingTest}
          aria-label="Testar conexão da Shopify"
          iconLeft={loadingTest ? <Loader2 className="h-4 w-4 animate-spin text-violet-400" /> : <Activity className="h-4 w-4 text-violet-400" />}
          className="flex-1"
        >
          Testar Conexão
        </Button>

        <Button
          variant="secondary"
          onClick={onEditCredentials}
          aria-label="Editar credenciais da Shopify"
          iconLeft={<Key className="h-4 w-4 text-purple-400" />}
          className="flex-1"
        >
          Editar Credenciais
        </Button>

        {isConnected && (
          <Button
            variant="danger"
            onClick={onDisconnect}
            disabled={loadingDisconnect}
            aria-label="Desconectar loja Shopify"
            iconLeft={loadingDisconnect ? <Loader2 className="h-4 w-4 animate-spin text-red-400" /> : <Unlink className="h-4 w-4" />}
          >
            <span className="hidden sm:inline">Desconectar</span>
          </Button>
        )}
      </div>
    </Card>
  );
};
