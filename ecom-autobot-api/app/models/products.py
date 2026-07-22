from pydantic import BaseModel, Field, HttpUrl
from typing import Optional, List, Dict
from datetime import datetime
from enum import Enum

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
    # Identificadores e Rastreabilidade
    id: Optional[str] = Field(None, alias="_id")
    tenant_id: Optional[str] = None
    sku: str = Field(..., min_length=3)
    
    # Informações de Negócio
    title: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = Field(default=None, ge=0) # Preço pode ser zero ou nulo
    currency: str = "BRL"
    
    # Dados de Mídia e Categorização
    images: List[str] = []
    category: str = "Geral"
    attributes: Dict[str, str] = {}
    
    # Sub-documento
    metadata: ScraperMetadata
    
    # Controle de Pipeline
    status: ProductStatus = ProductStatus.RAW
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None
    last_error: Optional[str] = None

    class Config:
        populate_by_name = True # Permite usar o nome do campo ou alias