/**
 * src/features/integrations/index.ts
 * Exportação pública da Feature de Integrações (Shopify, Nuvemshop, WooCommerce).
 */

export * from './types/integration.type';
export * from './types/shopify.type';
export * from './types/nuvemshop.type';
export * from './services/integration.service';
export * from './hooks/useIntegrations';
export * from './components/IntegrationKpiGrid';
export * from './components/ShopifyCard';
export * from './components/NuvemshopCard';
export * from './components/ShopifyCredentialsModal';
export * from './components/NuvemshopCredentialsModal';
export * from './pages/IntegrationsPage';

