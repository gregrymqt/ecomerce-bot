/**
 * src/features/integrations/types/shopify.type.ts
 *
 * Contratos de tipos e DTOs específicos para a integração GraphQL e Bulk API da Shopify.
 * Alinhado estritamente com os schemas Pydantic da FastAPI (app/features/shopify/schemas/shopify_schemas.py).
 */

/**
 * Status válidos para um produto no catálogo da Shopify.
 */
export type ShopifyProductStatus = 'ACTIVE' | 'DRAFT' | 'ARCHIVED';

/**
 * Payload enviado ao backend para sincronizar um produto individual com a Shopify.
 */
export interface ShopifySyncRequest {
  tenant_id?: string;
  sku: string;
  title: string;
  description?: string;
  vendor?: string;
  price?: number;
  images?: string[];
  tags?: string;
  seo_title?: string;
  seo_description?: string;
}

/**
 * Resposta padrão retornada pelas operações de produto da Shopify no backend.
 */
export interface ShopifyProductResponse {
  shopify_id?: string | null;
  status: 'success' | 'error' | string;
  message?: string | null;
  errors?: string[];
}

/**
 * Payload para atualização rápida de saldo de estoque por SKU na Shopify.
 */
export interface ShopifyInventoryUpdateInput {
  available_quantity: number;
  inventory_item_id?: string;
  location_id?: string;
}

/**
 * Payload para alteração de status do produto na Shopify (ACTIVE, DRAFT, ARCHIVED).
 */
export interface ShopifyStatusUpdateInput {
  status: ShopifyProductStatus;
}

/**
 * Payload para disparo de sincronização em massa de produtos via Bulk API GraphQL.
 */
export interface ShopifyBulkSyncRequest {
  skus: string[];
}

/**
 * Payload para adição de novas mídias/imagens à galeria de um produto na Shopify.
 */
export interface ShopifyMediaAddRequest {
  image_urls: string[];
  alt_text?: string;
}
