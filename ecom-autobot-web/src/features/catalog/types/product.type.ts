/**
 * Status possíveis de um produto no ciclo de vida do bot.
 */
export type ProductStatus = 'RAW' | 'PROCESSING' | 'PROCESSED' | 'FAILED' | 'EXPORTED' | 'Raw' | 'Processing' | 'Processed' | 'Failed' | 'Exported';

/**
 * Metadados de extração capturados pelo ScraperWorker.
 */
export interface ScraperMetadata {
  extracted_at?: string;
  source_domain?: string;
  parser_used?: string;
  raw_title?: string;
  raw_description?: string;
  raw_price?: string;
  [key: string]: unknown;
}

/**
 * Entidade de Produto do Catálogo.
 */
export interface Product {
  tenant_id: string;
  sku: string;
  title: string;
  description?: string | null;
  price?: number | string | null;
  currency?: string | null;
  status: ProductStatus | string;
  seo_title?: string | null;
  seo_description?: string | null;
  tags?: string[] | null;
  copywriting?: string | null;
  images?: string[] | null;
  raw_payload?: Record<string, unknown> | null;
  attributes?: Record<string, unknown> | null;
  metadata?: ScraperMetadata | null;
  created_at?: string | null;
  updated_at?: string | null;
}

/**
 * Payload de atualização enviada para a rota PATCH /api/v1/products/{sku}.
 */
export interface ProductUpdatePayload {
  title?: string;
  description?: string;
  price?: number;
  status?: ProductStatus | string;
  attributes?: Record<string, unknown>;
}

/**
 * Parâmetros de filtro para consulta paginada do catálogo.
 */
export interface ProductFilterParams {
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}

/**
 * Resposta paginada retornada pelo endpoint GET /api/v1/products.
 */
export interface PaginatedProductsResponse {
  items: Product[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}
