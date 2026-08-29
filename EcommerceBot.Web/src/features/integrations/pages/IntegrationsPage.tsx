/**
 * src/features/integrations/pages/IntegrationsPage.tsx
 *
 * Página Principal da Central de Integrações.
 * Exibe grid de KPIs, cards de plataformas conectadas (Shopify, Nuvemshop),
 * banner de segurança e modais de credenciais.
 */

import React from 'react';
import {
  Link as LinkIcon,
  Plus,
  ShieldCheck,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { useIntegrations } from '../hooks';
import {
  IntegrationKpiGrid,
  ShopifyCard,
  NuvemshopCard,
  ShopifyCredentialsModal,
  NuvemshopCredentialsModal,
} from '../components';
import { Button, Alert } from '@/components/ui';

export const IntegrationsPage: React.FC = () => {
  const {
    summary,
    integrations,
    loading,
    actionLoading,
    isShopifyModalOpen,
    setIsShopifyModalOpen,
    isNuvemshopModalOpen,
    setIsNuvemshopModalOpen,
    error,
    setError,
    successMessage,
    setSuccessMessage,
    handleSaveShopify,
    handleSaveNuvemshop,
    handleTestConnection,
    handleDisconnect,
    handleConnectNuvemshop,
  } = useIntegrations();

  const shopifyIntegration = integrations.find((item) => item.platform === 'SHOPIFY') || null;
  const nuvemshopIntegration = integrations.find((item) => item.platform === 'NUVEMSHOP') || null;
  const hasConnectedStore = Boolean(shopifyIntegration || nuvemshopIntegration);

  return (
    <div
      role="main"
      aria-label="Central de Integrações de E-commerce"
      className="space-y-8 max-w-7xl mx-auto pb-16 px-4 sm:px-6"
    >
      {/* Cabeçalho da Página */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-400 mb-1">
            <LinkIcon className="h-4 w-4" />
            <span>Ecossistema Multi-Store</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            Central de Integrações
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Conecte suas lojas Shopify e Nuvemshop para enriquecimento e sincronização de produtos em tempo real.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={() => setIsShopifyModalOpen(true)}
            aria-label="Adicionar Nova Loja"
            iconLeft={<Plus className="h-4 w-4" />}
            className="min-h-[44px] bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-lg shadow-indigo-600/25"
          >
            Adicionar Nova Loja
          </Button>
        </div>
      </header>

      {/* Alertas de Erro ou Sucesso */}
      {error && (
        <div className="animate-fade-in">
          <Alert variant="error" title="Erro de Integração" onClose={() => setError(null)}>
            {error}
          </Alert>
        </div>
      )}

      {successMessage && (
        <div className="animate-fade-in">
          <Alert variant="success" title="Sucesso" onClose={() => setSuccessMessage(null)}>
            {successMessage}
          </Alert>
        </div>
      )}

      {/* Seção 1: Grid de KPIs */}
      <section aria-label="Métricas de Integração">
        <IntegrationKpiGrid summary={summary} loading={loading} />
      </section>

      {/* Empty State Banner (quando nenhuma loja conectada) */}
      {!loading && !hasConnectedStore && (
        <section
          aria-label="Primeiros Passos de Integração"
          className="rounded-2xl bg-[#15121B] border border-slate-800 p-6 sm:p-8 text-center sm:text-left flex flex-col sm:flex-row items-center justify-between gap-6 shadow-xl"
        >
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-bold">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Primeiros Passos</span>
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-white">
              Nenhuma loja conectada ainda
            </h3>
            <p className="text-xs sm:text-sm text-slate-300 max-w-xl">
              Conecte sua loja Shopify ou Nuvemshop abaixo para começar a catalogar produtos enriquecidos por IA e sincronizar estoques automaticamente.
            </p>
          </div>

          <Button
            variant="primary"
            size="md"
            onClick={() => setIsShopifyModalOpen(true)}
            aria-label="Conectar Shopify Agora"
            iconRight={<ArrowRight className="h-4 w-4" />}
            className="shrink-0 bg-indigo-600 hover:bg-indigo-500 font-bold text-white shadow-xl shadow-indigo-600/25 min-h-[44px]"
          >
            Conectar Shopify Agora
          </Button>
        </section>
      )}

      {/* Seção 2: Grid de Cards das Plataformas */}
      <section
        aria-label="Plataformas Disponíveis para Integração"
        className="grid grid-cols-1 lg:grid-cols-2 gap-6"
      >
        <ShopifyCard
          integration={shopifyIntegration}
          loadingTest={Boolean(actionLoading[`test_${shopifyIntegration?.id}`])}
          loadingDisconnect={Boolean(actionLoading[`disconnect_${shopifyIntegration?.id}`])}
          onTestConnection={() => shopifyIntegration && handleTestConnection(shopifyIntegration.id)}
          onEditCredentials={() => setIsShopifyModalOpen(true)}
          onDisconnect={() => shopifyIntegration && handleDisconnect(shopifyIntegration.id)}
        />

        <NuvemshopCard
          integration={nuvemshopIntegration}
          loadingTest={Boolean(actionLoading[`test_${nuvemshopIntegration?.id}`])}
          loadingDisconnect={Boolean(actionLoading[`disconnect_${nuvemshopIntegration?.id}`])}
          loadingOAuth={Boolean(actionLoading['connect_nuvemshop'])}
          onConnectOAuth={handleConnectNuvemshop}
          onEditCredentials={() => setIsNuvemshopModalOpen(true)}
          onTestConnection={nuvemshopIntegration ? () => handleTestConnection(nuvemshopIntegration.id) : undefined}
          onDisconnect={nuvemshopIntegration ? () => handleDisconnect(nuvemshopIntegration.id) : undefined}
        />
      </section>

      {/* Banner Informativo de Segurança */}
      <section
        aria-label="Segurança e Criptografia"
        className="rounded-2xl bg-[#15121B] border border-[#1E293B] p-6 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl"
      >
        <div className="flex items-center gap-3.5">
          <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white">Sincronização 100% Segura & Criptografada</h4>
            <p className="text-xs text-slate-400 mt-0.5">
              Todas as chamadas GraphQL/REST utilizam o cabeçalho isolado por tenant e credenciais salvas no <strong>Microsoft SQL Server 2022</strong> com criptografia <strong>AES-256 GCM (BYOK)</strong>.
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

      {/* Modal de Credenciais da Nuvemshop */}
      <NuvemshopCredentialsModal
        isOpen={isNuvemshopModalOpen}
        onClose={() => setIsNuvemshopModalOpen(false)}
        onSave={handleSaveNuvemshop}
        onConnectOAuth={handleConnectNuvemshop}
        loading={Boolean(actionLoading['save_nuvemshop'])}
        initialStoreId={nuvemshopIntegration?.store_domain || ''}
      />
    </div>
  );
};

export default IntegrationsPage;
