/**
 * src/features/integrations/types/nuvemshop.type.ts
 *
 * Contratos de tipos e DTOs específicos para a integração REST, Worker Queue e Mídia da Nuvemshop.
 * Alinhado estritamente com os schemas Pydantic da FastAPI (app/features/nuvemshop/schemas/nuvemshop_schemas.py).
 */

/**
 * Níveis de visibilidade suportados para produtos na Nuvemshop.
 */
export type NuvemshopVisibility = 'visible' | 'unlisted' | 'hidden';

/**
 * Payload enviado ao backend para iniciar a sincronização assíncrona em lote na Nuvemshop via RabbitMQ.
 */
export interface NuvemshopBulkSyncRequest {
  skus: string[];
  force_update?: boolean;
  visibility?: NuvemshopVisibility;
}

/**
 * Resposta de enfileiramento retornado pelo endpoint POST /api/v1/nuvemshop/products/bulk-sync (HTTP 202 Accepted).
 */
export interface NuvemshopBulkSyncResponse {
  job_id: string;
  status: string;
  total_enqueued: number;
  message: string;
}

/**
 * Item individual para atualização rápida em lote de preço e estoque na Nuvemshop.
 */
export interface NuvemshopBatchStockPriceItem {
  variant_id: number;
  price?: number;
  promotional_price?: number;
  stock?: number;
}

/**
 * Resposta consolidada da atualização em lote de saldo e preço.
 */
export interface NuvemshopBatchStockPriceResponse {
  updated: number;
  failed: number;
  errors: string[];
}

/**
 * Payload para upload de imagem na galeria da Nuvemshop.
 */
export interface NuvemshopImageUploadPayload {
  src?: string;
  attachment?: string;
  filename?: string;
  position?: number;
  alt?: string;
}

/**
 * Resposta de imagem cadastrada na galeria da Nuvemshop.
 */
export interface NuvemshopImageResponse {
  id: number;
  product_id: number;
  src: string;
  position: number;
  alt?: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * Estrutura de categoria retornada pela API Nuvemshop.
 */
export interface NuvemshopCategory {
  id: number;
  name: {
    pt: string;
    [language: string]: string;
  };
  parent_id?: number | null;
  description?: {
    pt?: string;
  };
}
