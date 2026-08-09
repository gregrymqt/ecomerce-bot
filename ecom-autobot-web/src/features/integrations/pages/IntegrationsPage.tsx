/**
 * src/features/integrations/pages/IntegrationsPage.tsx
 *
 * Página Principal da Central de Integrações.
 * Exibe grid de KPIs, cards de plataformas conectadas (Shopify, Nuvemshop) e modal de credenciais.
 */

import React from 'react';
import { Link as LinkIcon, Plus, ShieldCheck, AlertCircle, CheckCircle } from 'lucide-react';
import { useIntegrations } from '@/features/integrations';
import { IntegrationKpiGrid } from '@/features/integrations';
import { ShopifyCard } from '@/features/integrations';
import { NuvemshopCard } from '@/features/integrations';
import { ShopifyCredentialsModal } from '@/features/integrations';

export const IntegrationsPage: React.FC = () => {
  const {
    summary,
    integrations,
    loading,
    actionLoading,
    isShopifyModalOpen,
    setIsShopifyModalOpen,
    error,
    setError,
    successMessage,
    setSuccessMessage,
    handleSaveShopify,
    handleTestConnection,
    handleDisconnect,
    handleConnectNuvemshop,
  } = useIntegrations();

  const shopifyIntegration = integrations.find((item) => item.platform === 'SHOPIFY') || null;

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16 px-4 sm:px-6">
      {/* Cabeçalho da Página */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1E293B] pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-violet-400 mb-1">
            <LinkIcon className="h-4 w-4" />
            <span>Ecossistema Multi-Store</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            Central de Integrações
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Conecte suas lojas Shopify, Nuvemshop e WooCommerce para publicação e sincronização de produtos em tempo real.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setIsShopifyModalOpen(true)}
            className="min-h-[44px] h-11 px-5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-sm transition-all shadow-lg shadow-violet-600/20 flex items-center gap-2 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Adicionar Nova Loja</span>
          </button>
        </div>
      </div>

      {/* Alertas de Erro ou Sucesso */}
      {error && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4 text-sm text-red-400 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-xs font-bold underline hover:text-white ml-4 cursor-pointer"
          >
            Fechar
          </button>
        </div>
      )}

      {successMessage && (
        <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-4 text-sm text-emerald-400 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            className="text-xs font-bold underline hover:text-white ml-4 cursor-pointer"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Seção 1: Grid de KPIs */}
      <section>
        <IntegrationKpiGrid summary={summary} loading={loading} />
      </section>

      {/* Seção 2: Grid de Cards das Plataformas */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ShopifyCard
          integration={shopifyIntegration}
          loadingTest={Boolean(actionLoading[`test_${shopifyIntegration?.id}`])}
          loadingDisconnect={Boolean(actionLoading[`disconnect_${shopifyIntegration?.id}`])}
          onTestConnection={() => shopifyIntegration && handleTestConnection(shopifyIntegration.id)}
          onEditCredentials={() => setIsShopifyModalOpen(true)}
          onDisconnect={() => shopifyIntegration && handleDisconnect(shopifyIntegration.id)}
        />

        <NuvemshopCard
          loading={Boolean(actionLoading['connect_nuvemshop'])}
          onConnectOAuth={handleConnectNuvemshop}
        />
      </section>

      {/* Banner Informativo de Segurança */}
      <section className="rounded-2xl bg-[#15121B] border border-[#1E293B] p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-8 w-8 text-emerald-400 shrink-0" />
          <div>
            <h4 className="text-sm font-bold text-white">Sincronização 100% Segura & Criptografada</h4>
            <p className="text-xs text-slate-400 mt-0.5">
              Todas as chamadas GraphQL/REST utilizam o cabeçalho isolado por tenant e credenciais BYOK salvas no PostgreSQL.
            </p>
          </div>
        </div>
      </section>

      {/* Modal de Credenciais da Shopify */}
      <ShopifyCredentialsModal
        isOpen={isShopifyModalOpen}
        onClose={() => setIsShopifyModalOpen(false)}
        onSave={handleSaveShopify}
        loading={Boolean(actionLoading['save_shopify'])}
        initialDomain={shopifyIntegration?.store_domain || ''}
      />
    </div>
  );
};

export default IntegrationsPage;
