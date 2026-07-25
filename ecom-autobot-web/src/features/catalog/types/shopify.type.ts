/**
 * Payload interno para envio do produto para o Shopify.
 */
export interface ShopifySyncProductPayload {
  tenant_id?: string;
  sku: string;
  title: string;
  description?: string;
  price: number;
  vendor?: string;
  tags?: string[] | string;
  seo_title?: string;
  seo_description?: string;
  images?: string[];
}

/**
 * Resposta de sucesso ou Fallback CSV da sincronização (HTTP 200/201 ou HTTP 202).
 */
export interface ShopifySyncResponse {
  status: string;
  message?: string;
  download_url?: string;
  productSet?: {
    product?: {
      id: string;
      title: string;
    };
    operation?: {
      id: string;
      status: string;
    };
    userErrors?: Array<{ field: string[]; message: string }>;
  };
}

/**
 * Requisição para adicionar imagens a um produto existente no Shopify.
 */
export interface ShopifyMediaAddPayload {
  image_urls: string[];
  alt_text?: string;
}

/**
 * Payload para atualização de produto no Shopify.
 */
export interface ShopifyProductUpdatePayload {
  title?: string;
  handle?: string;
  vendor?: string;
  product_type?: string;
  status?: 'ACTIVE' | 'ARCHIVED' | 'DRAFT';
  tags?: string[];
  seo_title?: string;
  seo_description?: string;
  new_images?: Array<{ url: string; alt?: string }>;
}

/**
 * Estrutura do Nó do Produto vindo da API GraphQL do Shopify.
 */
export interface ShopifyNode {
  id: string;
  title: string;
  vendor?: string;
  status: string;
  productType?: string;
}

export interface ShopifyEdge {
  cursor: string;
  node: ShopifyNode;
}

export interface ShopifyPageInfo {
  hasNextPage: boolean;
  endCursor: string | null;
}

/**
 * Resposta paginada de listagem vinda do Shopify GraphQL.
 */
export interface ShopifyProductListResponse {
  edges: ShopifyEdge[];
  pageInfo: ShopifyPageInfo;
}