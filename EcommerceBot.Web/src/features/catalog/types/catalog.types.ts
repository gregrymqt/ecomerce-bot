import type { ProductStatus } from './product.type';

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
