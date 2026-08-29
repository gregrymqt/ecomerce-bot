/**
 * src/features/catalog/types/catalog.types.ts
 *
 * Contratos de tipos específicos para controle de UI, filtros e visualização do Catálogo.
 */

import type { ProductStatus } from './product.types';

export type { ProductStatus };
export type EcomPlatform = 'Shopify' | 'Nuvemshop' | 'WooCommerce';
export type AITone = 'Persuasivo' | 'Direto' | 'Premium';

export interface CatalogProduct {
  id: string;
  sku: string;
  titleOriginal: string;
  titleAi: string;
  descriptionAi: string;
  thumbnailUrl: string;
  platform: EcomPlatform;
  status: ProductStatus;
  synced: boolean;
  createdAt: string;
}

export type FilterStatus = 'ALL' | ProductStatus;
