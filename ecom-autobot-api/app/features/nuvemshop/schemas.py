from pydantic import BaseModel, Field
from typing import List, Optional, Dict

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
    def from_internal_data(cls, data: Dict):
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
                    sku=data.get("sku")
                )
            ],
            images=[NuvemshopImageRequest(src=img) for img in data.get("images", [])]
        )
