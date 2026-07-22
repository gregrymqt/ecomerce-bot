from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List

class ImportRequestMessage(BaseModel):
    product_id: str = Field(..., alias="ProductId")
    tenant_id: str = Field(..., alias="TenantId")
    target_url: str = Field(..., alias="TargetUrl")

    class Config:
        populate_by_name = True


class ImportCompletedMessage(BaseModel):
    success: bool = Field(..., alias="Success")
    product_id: str = Field(..., alias="ProductId")
    tenant_id: str = Field(..., alias="TenantId")
    error: Optional[str] = Field(None, alias="Error")
    
    # Payload elements from enriched product
    title: Optional[str] = Field(None, alias="Title")
    description: Optional[str] = Field(None, alias="Description")
    price: Optional[float] = Field(None, alias="Price")
    images: Optional[List[str]] = Field(default_factory=list, alias="Images")
    attributes: Optional[Dict[str, Any]] = Field(default_factory=dict, alias="Attributes")

    class Config:
        populate_by_name = True
