from typing import Any
from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional
from pydantic import BaseModel, Field, HttpUrl


class ProductStatus(str, Enum):
    RAW = "Raw"
    PROCESSING = "Processing"
    PROCESSED = "Processed"
    FAILED = "Failed"
    EXPORTED = "Exported"


class ScraperMetadata(BaseModel):
    source_url: HttpUrl
    last_scraped_at: Optional[datetime] = None
    scraper_version: str = ""


class Product(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    tenant_id: Optional[str] = None
    sku: str = Field(..., min_length=3)

    title: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = Field(default=None, ge=0)
    currency: str = "BRL"

    images: List[str] = []
    category: str = "Geral"
    attributes: Dict[str, str] = {}

    metadata: ScraperMetadata

    status: ProductStatus = ProductStatus.RAW
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None
    last_error: Optional[str] = None

    class Config:
        populate_by_name = True

# --- NOVOS SCHEMAS PARA O CATÁLOGO ---

class ProductUpdateSchema(BaseModel):
    """Schema para edição manual de dados do produto no Catálogo."""
    title: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = Field(None, ge=0)
    status: Optional[ProductStatus] = None
    attributes: Optional[Dict[str, Any]] = None


class PaginatedProductsResponse(BaseModel):
    """Resposta paginada para a Datatable do Frontend."""
    items: List[Product]
    total: int
    page: int
    limit: int
    pages: int