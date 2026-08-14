from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field


class NuvemshopLocalizedString(BaseModel):
    pt: str


class NuvemshopVariantRequest(BaseModel):
    price: Optional[float] = Field(None, description="Preço do produto")
    compare_at_price: Optional[float] = Field(None, description="Preço promocional/antigo")
    stock: Optional[int] = Field(None, description="Quantidade em estoque")
    sku: Optional[str] = Field(None, description="Código SKU")
    weight: Optional[float] = Field(None, description="Peso em kg")
    width: Optional[float] = Field(None, description="Largura em cm")
    height: Optional[float] = Field(None, description="Altura em cm")
    depth: Optional[float] = Field(None, description="Profundidade em cm")


class NuvemshopImageRequest(BaseModel):
    src: str
    alt: Optional[NuvemshopLocalizedString] = None


class NuvemshopProductRequest(BaseModel):
    tenant_id: str = Field(...)
    handle: NuvemshopLocalizedString = Field(..., alias="handle")
    name: NuvemshopLocalizedString
    description: NuvemshopLocalizedString
    seo_title: Optional[NuvemshopLocalizedString] = None
    seo_description: Optional[NuvemshopLocalizedString] = None
    published: bool = Field(True, description="Exibir na loja (SIM/NÃO no CSV)")
    free_shipping: bool = False
    requires_shipping: bool = Field(True, description="Produto Físico (SIM/NÃO no CSV)")
    brand: Optional[str] = None
    categories: List[int] = []
    tags: Optional[str] = Field(None, description="Tags separadas por vírgula")
    variants: List[NuvemshopVariantRequest]
    images: List[NuvemshopImageRequest] = []

    class Config:
        populate_by_name = True

    @classmethod
    def from_internal_data(cls, data: Dict[str, Any]):
        return cls(
            tenant_id=data.get("tenant_id", ""),
            handle={"pt": data.get("slug", "")},
            name={"pt": data.get("title", "")},
            description={"pt": data.get("description", "")},
            seo_title={"pt": data.get("seo_title", data.get("title", ""))},
            seo_description={"pt": data.get("seo_description", "")},
            published=True,
            requires_shipping=True,
            tags=",".join(data.get("tags", [])) if isinstance(data.get("tags"), list) else str(data.get("tags", "")),
            variants=[
                NuvemshopVariantRequest(
                    price=float(data.get("price", 0.0)),
                    stock=999,
                    sku=data.get("sku"),
                )
            ],
            images=[NuvemshopImageRequest(src=img) for img in data.get("images", [])],
        )


class NuvemshopBatchStockPriceItem(BaseModel):
    variant_id: int = Field(..., description="ID da variante na Nuvemshop")
    price: Optional[float] = Field(None, description="Novo preço da variante")
    promotional_price: Optional[float] = Field(None, description="Novo preço promocional")
    stock: Optional[int] = Field(None, description="Quantidade em estoque")


class NuvemshopProductUpdatePayload(BaseModel):
    name: Optional[Dict[str, str]] = None
    description: Optional[Dict[str, str]] = None
    handle: Optional[Dict[str, str]] = None
    visibility: Optional[str] = Field(None, description="Visibilidade ('visible', 'unlisted', 'hidden'). NUNCA enviar com published.")
    brand: Optional[str] = None
    tags: Optional[str] = None
    seo_title: Optional[Dict[str, str]] = None
    seo_description: Optional[Dict[str, str]] = None
    categories: Optional[List[int]] = Field(None, description="Omitir se não houver alteração de categorias.")
    variants: Optional[List["NuvemshopProductVariantPayload"]] = None
    images: Optional[List["NuvemshopImagePayload"]] = None


class NuvemshopProductVariantPayload(BaseModel):
    price: Optional[float] = Field(None, description="Preço de venda da variante")
    promotional_price: Optional[float] = Field(None, description="Preço promocional/antigo")
    stock: Optional[int] = Field(None, description="Quantidade em estoque")
    stock_management: bool = Field(True, description="Habilita gestão de estoque")
    sku: Optional[str] = Field(None, description="SKU da variante")
    weight: Optional[float] = Field(None, description="Peso em kg")
    cost: Optional[float] = Field(None, description="Custo do produto")


class NuvemshopImagePayload(BaseModel):
    src: str = Field(..., description="URL pública da imagem")
    position: Optional[int] = Field(None, description="Ordem de exibição na galeria (1-indexed)")


class NuvemshopProductCreatePayload(BaseModel):
    name: Dict[str, str] = Field(..., description="Nome em dicionário de idiomas, ex: {'pt': 'Nome'}")
    description: Dict[str, str] = Field(..., description="Descrição HTML em dicionário, ex: {'pt': '<p>Desc</p>'}")
    visibility: str = Field("visible", description="Visibilidade: 'visible', 'unlisted' ou 'hidden'. NÃO enviar publicado/published.")
    tags: Optional[str] = Field(None, description="String de tags separadas por vírgula")
    seo_title: Optional[Dict[str, str]] = Field(None, description="Título SEO multilíngue")
    seo_description: Optional[Dict[str, str]] = Field(None, description="Descrição SEO multilíngue")
    variants: List[NuvemshopProductVariantPayload] = Field(default_factory=list, description="Lista de variantes")
    images: Optional[List[NuvemshopImagePayload]] = Field(None, description="Galeria inicial (limite máximo de 9 imagens)")
    categories: Optional[List[int]] = Field(None, description="IDs das categorias")


class NuvemshopProductResponse(BaseModel):
    """DTO de resposta genérico para operações de produto na Nuvemshop (criação, atualização, busca)."""

    nuvemshop_id: Optional[int] = Field(None, description="ID do produto na Nuvemshop.")
    sku: Optional[str] = Field(None, description="SKU do produto.")
    status: str = Field(..., description="Status da operação: 'success' ou 'error'.")
    message: Optional[str] = Field(None, description="Mensagem complementar ou descrição de erro.")
    errors: List[str] = Field(default=[], description="Lista de erros retornados pela API Nuvemshop.")

    model_config = {"from_attributes": True}


class NuvemshopBatchStockPriceResponse(BaseModel):
    """DTO de resposta para operações em lote de estoque e preço na Nuvemshop."""

    updated: int = Field(default=0, description="Quantidade de variantes atualizadas com sucesso.")
    failed: int = Field(default=0, description="Quantidade de variantes que falharam.")
    errors: List[str] = Field(default=[], description="Lista de erros por item do lote.")

    model_config = {"from_attributes": True}


class NuvemshopImageBasePayload(BaseModel):
    position: Optional[int] = Field(None, ge=1, description="Posição na galeria (1 = capa)")
    alt: Optional[str] = Field(None, max_length=255, description="Texto alternativo para SEO")


class NuvemshopImageUploadPayload(NuvemshopImageBasePayload):
    src: Optional[str] = Field(None, description="URL pública acessível da imagem")
    attachment: Optional[str] = Field(None, description="String Base64 da imagem (fallback de buffer em memória)")
    filename: Optional[str] = Field(None, description="Nome do arquivo obrigatório quando enviado via Base64")


class NuvemshopImageUpdatePayload(BaseModel):
    position: Optional[int] = Field(None, ge=1, description="Nova posição na galeria")
    src: Optional[str] = Field(None, description="Nova URL da imagem")


class NuvemshopImageResponse(BaseModel):
    id: int = Field(..., description="ID da imagem na Nuvemshop")
    product_id: int = Field(..., description="ID do produto na Nuvemshop")
    src: str = Field(..., description="URL pública da imagem na CDN da Nuvemshop")
    position: int = Field(..., description="Posição na galeria")
    alt: Optional[str] = Field(None, description="Texto alternativo")
    created_at: Optional[str] = Field(None, description="Data de criação")
    updated_at: Optional[str] = Field(None, description="Data da última atualização")

    model_config = {"from_attributes": True}


