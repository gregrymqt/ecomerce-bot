from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


class AuthenticatedUser(BaseModel):
    user_id: str = Field(..., alias="sub", json_schema_extra={"example": "usr_123456"})
    email: str = Field(..., json_schema_extra={"example": "admin@ecommerce.com"})
    name: str = Field(..., json_schema_extra={"example": "Admin"})
    tenants: List[str] = Field(default_factory=lambda: ["ecommerce_demo", "ecommerce_prod"])
    plan: str = Field(default="free", json_schema_extra={"example": "free"})
    is_admin: bool = Field(default=False, json_schema_extra={"example": True})
    role: str = Field(default="user", json_schema_extra={"example": "admin"})

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)


class LoginRequest(BaseModel):
    email: str = Field(..., json_schema_extra={"example": "admin@ecommerce.com"})
    password: str = Field(..., min_length=4, json_schema_extra={"example": "admin123"})
    tenant_id: Optional[str] = Field(None, description="Tenant inicial desejado", json_schema_extra={"example": "ecommerce_demo"})


class LogoutResponse(BaseModel):
    message: str
