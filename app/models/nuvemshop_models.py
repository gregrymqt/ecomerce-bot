from pydantic import BaseModel, Field, validator
from typing import List, Optional, Dict, Union

class NuvemshopLocalizedString(BaseModel):
    """
    Representa o padrão de internacionalização da Nuvemshop.
    Como o foco é o mercado brasileiro, o default é 'pt'.
    """
    pt: str

class NuvemshopVariantRequest(BaseModel):
    """
    Representa uma variante de produto. 
    Nota: Preço e Estoque na Nuvemshop residem na variante.
    """
    price: Optional[float] = Field(None, description="Preço do produto")
    compare_at_price: Optional[float] = Field(None, description="Preço promocional/antigo")
    stock: Optional[int] = Field(None, description="Quantidade em estoque")
    sku: Optional[str] = Field(None, description="Código SKU")
    weight: Optional[float] = Field(None, description="Peso em kg")
    width: Optional[float] = Field(None, description="Largura em cm")
    height: Optional[float] = Field(None, description="Altura em cm")
    depth: Optional[float] = Field(None, description="Profundidade em cm")

class NuvemshopImageRequest(BaseModel):
    """
    Representa uma imagem a ser enviada via URL.
    """
    src: str
    alt: Optional[NuvemshopLocalizedString] = None

class NuvemshopProductRequest(BaseModel):
    """
    Model principal para criação de produto via API Nuvemshop.
    Alinhada com os headers do seu CsvExportService.
    """
    # Tenant Isolation
    tenant_id: str = Field(...)

    # Identificador URL (Slug)
    handle: NuvemshopLocalizedString = Field(..., alias="handle")
    
    # Nome
    name: NuvemshopLocalizedString
    
    # Descrição (HTML vindo da IA)
    description: NuvemshopLocalizedString
    
    # SEO
    seo_title: Optional[NuvemshopLocalizedString] = None
    seo_description: Optional[NuvemshopLocalizedString] = None
    
    # Atributos de Loja
    published: bool = Field(True, description="Exibir na loja (SIM/NÃO no CSV)")
    free_shipping: bool = False
    requires_shipping: bool = Field(True, description="Produto Físico (SIM/NÃO no CSV)")
    
    # Organização
    brand: Optional[str] = None
    categories: List[int] = []
    tags: Optional[str] = Field(None, description="Tags separadas por vírgula")
    
    # Dados de Venda (Lista de variantes, pelo menos uma é necessária)
    variants: List[NuvemshopVariantRequest]
    
    # Mídia
    images: List[NuvemshopImageRequest] = []

    class Config:
        populate_by_name = True

    @classmethod
    def from_internal_data(cls, data: Dict):
        """
        Método auxiliar para converter o dicionário interno (p.get no seu CSV)
        para o formato de internacionalização da Nuvemshop.
        """
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
                    stock=999, # Default para produtos de drop
                    sku=data.get("sku")
                )
            ],
            images=[NuvemshopImageRequest(src=img) for img in data.get("images", [])]
        )