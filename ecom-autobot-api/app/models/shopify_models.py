from typing import List, Optional
from pydantic import BaseModel, Field

class ShopifyOptionValueInput(BaseModel):
    optionName: str = Field(..., description="Nome da opção, ex: 'Color'")
    name: str = Field(..., description="Valor da opção, ex: 'Blue'")

class ShopifyFileInput(BaseModel):
    originalSource: str = Field(..., description="URL pública da imagem hospedada.")
    alt: Optional[str] = Field(None, description="Texto alternativo gerado pela IA para SEO.")
    filename: Optional[str] = Field(None, description="Nome do arquivo.")
    contentType: str = "IMAGE"

class ShopifyVariantInput(BaseModel):
    price: str
    sku: Optional[str] = None
    inventoryItem: Optional[dict] = Field(None, description="Dados de estoque e rastreamento")
    optionValues: List[ShopifyOptionValueInput]
    file: Optional[ShopifyFileInput] = None

class ShopifyProductOptionInput(BaseModel):
    name: str
    values: List[dict] # Ex: [{"name": "Blue"}, {"name": "Red"}]

class ShopifyProductSetInput(BaseModel):
    """
    Input principal para a mutação productSet (Stable 2024-04).
    Ideal para sincronização externa (ERP/Bot).
    """
    tenant_id: str
    title: str
    descriptionHtml: str
    vendor: str
    productType: Optional[str] = None
    status: str = "DRAFT" # ACTIVE, ARCHIVED, DRAFT
    productOptions: List[ShopifyProductOptionInput] = []
    variants: List[ShopifyVariantInput] = []
    files: List[ShopifyFileInput] = []
    seoTitle: Optional[str] = None
    seoDescription: Optional[str] = None
    tags: Optional[str] = None

    @classmethod
    def from_internal_data(cls, data: dict):
        tags = data.get("tags", "")
        tags_str = ",".join(tags) if isinstance(tags, list) else str(tags)
        
        return cls(
            tenant_id=data.get("tenant_id", ""),
            title=data.get("title", ""),
            descriptionHtml=data.get("description", ""),
            vendor=data.get("vendor", "Default Vendor"),
            status="DRAFT",
            productOptions=[],
            variants=[
                ShopifyVariantInput(
                    price=str(data.get("price", 0.0)),
                    sku=data.get("sku", ""),
                    optionValues=[]
                )
            ],
            seoTitle=data.get("seo_title", data.get("title", "")),
            seoDescription=data.get("seo_description", ""),
            tags=tags_str
        )

class ShopifyGraphQLVariables(BaseModel):
    input: ShopifyProductSetInput

class ShopifyGraphQLRequest(BaseModel):
    """
    Payload final enviado via POST para /admin/api/2024-04/graphql.json
    """
    query: str = """
    mutation productSet($input: ProductSetInput!) {
      productSet(input: $input) {
        product {
          id
          title
        }
        operation {
          id
          status
        }
        userErrors {
          field
          message
        }
      }
    }
    """
    variables: ShopifyGraphQLVariables




from typing import List, Optional
from pydantic import BaseModel, Field

class ShopifySEOInput(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None

class ShopifyProductUpdateInput(BaseModel):
    """
    Propriedades passíveis de modificação pela IA no ciclo de atualização.
    """
    tenant_id: str = Field(..., description="ID do tenant")
    id: str = Field(..., description="GID do Produto, ex: 'gid://shopify/Product/108828309'")
    title: Optional[str] = None
    handle: Optional[str] = None
    vendor: Optional[str] = None
    productType: Optional[str] = None
    status: Optional[str] = None  # ACTIVE, ARCHIVED, DRAFT
    tags: Optional[List[str]] = None
    seo: Optional[ShopifySEOInput] = None

class ShopifyCreateMediaInput(BaseModel):
    """
    Formato aceito pelo argumento 'media' do productUpdate para novas cargas de IA.
    """
    originalSource: str = Field(..., description="URL pública da imagem gerada.")
    alt: Optional[str] = Field(None, description="Alt text otimizado para acessibilidade e SEO.")
    mediaContentType: str = "IMAGE"  # IMAGE, VIDEO, EXTERNAL_VIDEO

class ShopifyProductUpdateVariables(BaseModel):
    product: ShopifyProductUpdateInput
    media: Optional[List[ShopifyCreateMediaInput]] = None

class ShopifyProductUpdateRequest(BaseModel):
    """
    Payload final envelopado para a mutação productUpdate (Stable 2026-07).
    """
    query: str = """
    mutation UpdateProductComprehensive($product: ProductUpdateInput!, $media: [CreateMediaInput!]) {
      productUpdate(product: $product, media: $media) {
        product {
          id
          title
          status
          media(first: 10) {
            nodes {
              alt
              mediaContentType
              preview {
                status
              }
            }
          }
        }
        userErrors {
          field
          message
        }
      }
    }
    """
    variables: ShopifyProductUpdateVariables    


class ShopifyProductDeleteInput(BaseModel):
    id: str = Field(..., description="GID do Produto a ser removido definitivamente, ex: 'gid://shopify/Product/108828309'")

class ShopifyProductDeleteVariables(BaseModel):
    input: ShopifyProductDeleteInput

class ShopifyProductDeleteRequest(BaseModel):
    """
    Payload para execução da mutação productDelete.
    """
    query: str = """
    mutation DeleteProduct($input: ProductDeleteInput!) {
      productDelete(input: $input) {
        deletedProductId
        productDeleteOperation {
          id
          status
        }
        userErrors {
          field
          message
        }
      }
    }
    """
    variables: ShopifyProductDeleteVariables


class ShopifyPaginationParams(BaseModel):
    first: int = Field(default=10, ge=1, le=250, description="Quantidade de registros a buscar.")
    after: Optional[str] = Field(None, description="Cursor em Base64 para buscar registros após esta posição.")

class ShopifyProductListRequest(BaseModel):
    """
    Payload que encapsula a query de listagem com suporte a filtros e cursores.
    """
    query: str = """
    query GetProductsList($first: Int!, $after: String) {
      products(first: $first, after: $after) {
        edges {
          cursor
          node {
            id
            title
            vendor
            status
            productType
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
    """
    variables: dict




class ShopifyMediaInput(BaseModel):
      originalSource: str = Field(..., description="URL pública da imagem hospedada.")
      alt: Optional[str] = Field(None, description="Texto alternativo gerado pela IA para SEO.")
      mediaContentType: str = "IMAGE"

class ShopifyCreateMediaVariables(BaseModel):
      productId: str
      media: List[ShopifyMediaInput]

class ShopifyCreateMediaRequest(BaseModel):
      query: str = """
      mutation productCreateMedia($media: [CreateMediaInput!]!, $productId: ID!) {
        productCreateMedia(media: $media, productId: $productId) {
          media {
            alt
            mediaContentType
            status
          }
          mediaUserErrors {
            field
            message
          }
          product {
            id
            title
          }
        }
      }
      """
      variables: ShopifyCreateMediaVariables