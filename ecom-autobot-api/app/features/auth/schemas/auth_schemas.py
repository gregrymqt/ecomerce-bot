from typing import List, Optional
from pydantic import BaseModel, Field


class AuthenticatedUser(BaseModel):
    user_id: str = Field(..., alias="sub", example="usr_123456")
    email: str = Field(..., example="admin@ecommerce.com")
    name: str = Field(..., example="Admin")
    tenants: List[str] = Field(default_factory=lambda: ["ecommerce_demo", "ecommerce_prod"])
    plan: str = Field(default="free", example="free")
    is_admin: bool = Field(default=False, example=True)
    role: str = Field(default="user", example="admin")

    class Config:
        populate_by_name = True


class LoginRequest(BaseModel):
    email: str = Field(..., example="admin@ecommerce.com")
    password: str = Field(..., min_length=4, example="admin123")
    tenant_id: Optional[str] = Field(None, example="ecommerce_demo", description="Tenant inicial desejado")


class LogoutResponse(BaseModel):
    message: str
