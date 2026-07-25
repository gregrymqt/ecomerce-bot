/**
 * Estrutura de string localizada para a API da Nuvemshop (ex: { pt: "Nome do produto" }).
 */
export interface NuvemshopLocalizedString {
  pt: string;
}

/**
 * Dados de variante do produto Nuvemshop.
 */
export interface NuvemshopVariantRequest {
  price?: number;
  compare_at_price?: number;
  stock?: number;
  sku?: string;
  weight?: number;
  width?: number;
  height?: number;
  depth?: number;
}

/**
 * Imagem associada ao produto.
 */
export interface NuvemshopImageRequest {
  src: string;
  alt?: NuvemshopLocalizedString;
}

/**
 * Payload completo para criação de produto na Nuvemshop (POST /api/v1/nuvemshop/products).
 */
export interface NuvemshopProductRequest {
  tenant_id: string;
  handle: NuvemshopLocalizedString;
  name: NuvemshopLocalizedString;
  description: NuvemshopLocalizedString;
  seo_title?: NuvemshopLocalizedString;
  seo_description?: NuvemshopLocalizedString;
  published?: boolean;
  free_shipping?: boolean;
  requires_shipping?: boolean;
  brand?: string;
  categories?: number[];
  tags?: string;
  variants: NuvemshopVariantRequest[];
  images?: NuvemshopImageRequest[];
}

/**
 * Payload para atualização parcial de metadados do produto (PUT /api/v1/nuvemshop/products/{id}).
 */
export interface NuvemshopProductUpdatePayload {
  name?: NuvemshopLocalizedString;
  description?: NuvemshopLocalizedString;
  handle?: NuvemshopLocalizedString;
  published?: boolean;
  brand?: string;
  tags?: string;
}

/**
 * Item para atualização de estoque e preço em lote (PATCH /api/v1/nuvemshop/products/stock-price).
 */
export interface NuvemshopBatchStockPriceItem {
  variant_id: number;
  price?: number;
  promotional_price?: number;
  stock?: number;
}

/**
 * Resposta de sucesso ou Fallback CSV da sincronização (HTTP 201 ou HTTP 202).
 */
export interface NuvemshopSyncResponse {
  status?: string;
  message?: string;
  download_url?: string;
  id?: number;
  [key: string]: any;
}