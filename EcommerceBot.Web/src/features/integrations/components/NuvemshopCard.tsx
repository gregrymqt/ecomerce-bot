/**
 * src/features/integrations/components/NuvemshopCard.tsx
 *
 * Card de Integração com a Nuvemshop.
 * Exibe status de conexão, domínio/ID da loja, latência e ações contextuais simétricas.
 */

import React from 'react';
import {
  Store,
  ShieldCheck,
  ExternalLink,
  Loader2,
  CheckCircle,
  AlertCircle,
  Activity,
  Unlink,
  Globe,
  Key,
} from 'lucide-react';
import { Card, Button, Badge } from '@/components/ui';
import type { StoreIntegration } from '@/features/integrations';

interface NuvemshopCardProps {
  integration?: StoreIntegration | null;
  loadingTest?: boolean;
  loadingDisconnect?: boolean;
  loadingOAuth?: boolean;
  onConnectOAuth: () => void;
  onEditCredentials?: () => void;
  onTestConnection?: () => void;
  onDisconnect?: () => void;
  className?: string;
}

export const NuvemshopCard: React.FC<NuvemshopCardProps> = ({
  integration,
  loadingTest = false,
  loadingDisconnect = false,
  loadingOAuth = false,
  onConnectOAuth,
  onEditCredentials,
  onTestConnection,
  onDisconnect,
  className,
}) => {
  const isConnected = integration?.status === 'CONNECTED';
  const storeDomain = integration?.store_domain || 'Loja Nuvemshop Conectada';
  const latency = integration?.health_check_latency_ms ?? 0;
  const healthStatus = integration?.health_check_status || 'API REST Operacional';

  return (
    <Card
      className={`bg-[#15121B] border-[#1E293B] hover:border-slate-700 transition-all text-slate-100 space-y-6 flex flex-col justify-between shadow-xl ${
        className || ''
      }`}
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
                <Badge variant="purple">OAuth 2.0</Badge>
              </div>
              <p className="text-xs text-slate-400">Sincronização Bidirecional & Webhooks</p>
            </div>
          </div>

          <div>
            {isConnected ? (
              <Badge variant="success" dot className="px-3 py-1 font-semibold">
                <CheckCircle className="h-3.5 w-3.5 mr-1" />
                Conectado
              </Badge>
            ) : (
              <Badge variant="purple" dot className="px-3 py-1 font-semibold">
                <AlertCircle className="h-3.5 w-3.5 mr-1" />
                Desconectado
              </Badge>
            )}
          </div>
        </div>

        {/* Conteúdo Dinâmico por Estado */}
        {isConnected ? (
          <div className="py-5 space-y-4">
            {/* Detalhes da Conexão */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs sm:text-sm">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Globe className="h-4 w-4 text-purple-400" />
                  Identificador da Loja
                </span>
                <span className="font-mono font-bold text-white bg-slate-900/80 px-2.5 py-1 rounded-lg border border-slate-800">
                  {storeDomain}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs sm:text-sm">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-emerald-400" />
                  Autenticação
                </span>
                <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                  OAuth 2.0 Autorizado
                </span>
              </div>
            </div>

            {/* Painel de Health Check e Latência */}
            <div className="rounded-xl bg-[#090D16] border border-[#1E293B] p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-purple-500/10 p-2 text-purple-400 border border-purple-500/20">
                  <Activity className="h-4 w-4" />
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-200 block">{healthStatus}</span>
                  <span className="text-[11px] text-slate-400">Nuvemshop REST Protocol</span>
                </div>
              </div>

              <div className="text-right">
                <span className="text-xs font-mono font-bold text-purple-400 block">{latency} ms</span>
                <span className="text-[10px] text-slate-500">Latência medida</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="py-6 space-y-3.5 text-center sm:text-left">
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              A conexão com a Nuvemshop é realizada via autenticação segura <strong className="text-white">OAuth 2.0</strong> com 1-clique. Sem necessidade de digitar chaves manuais.
            </p>
            <div className="rounded-xl bg-[#090D16] border border-[#1E293B] p-3.5 flex items-center gap-3 text-xs text-slate-400">
              <ShieldCheck className="h-5 w-5 text-emerald-400 shrink-0" />
              <span>
                Você será redirecionado para autorizar o app oficial E-commerce Bot na sua loja Nuvemshop.
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Botões de Ação */}
      <div className="pt-4 border-t border-[#1E293B]">
        {isConnected ? (
          <div className="flex flex-wrap sm:flex-nowrap gap-2">
            {onTestConnection && (
              <Button
                variant="secondary"
                onClick={onTestConnection}
                disabled={loadingTest}
                aria-label="Testar conexão da Nuvemshop"
                iconLeft={
                  loadingTest ? (
                    <Loader2 className="h-4 w-4 animate-spin text-purple-400" />
                  ) : (
                    <Activity className="h-4 w-4 text-purple-400" />
                  )
                }
                className="flex-1 min-h-[44px]"
              >
                Testar Conexão
              </Button>
            )}

            {onEditCredentials && (
              <Button
                variant="secondary"
                onClick={onEditCredentials}
                aria-label="Editar credenciais da Nuvemshop"
                iconLeft={<Key className="h-4 w-4 text-purple-400" />}
                className="flex-1 min-h-[44px]"
              >
                Editar Token
              </Button>
            )}

            {onDisconnect && (
              <Button
                variant="danger"
                onClick={onDisconnect}
                disabled={loadingDisconnect}
                aria-label="Desconectar loja Nuvemshop"
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
            )}
          </div>
        ) : (
          <Button
            variant="primary"
            onClick={onConnectOAuth}
            disabled={loadingOAuth}
            iconLeft={
              loadingOAuth ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <ExternalLink className="h-5 w-5" />
              )
            }
            className="w-full h-12 bg-purple-600 hover:bg-purple-500 font-bold shadow-lg shadow-purple-600/25 text-white min-h-[44px]"
          >
            {loadingOAuth ? 'Redirecionando...' : 'Conectar via OAuth 2.0'}
          </Button>
        )}
      </div>
    </Card>
  );
};
