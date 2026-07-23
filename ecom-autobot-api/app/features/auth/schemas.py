from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

class AuthenticatedUser(BaseModel):
    user_id: str = Field(..., alias="sub", example="usr_123456")
    email: str = Field(..., example="admin@ecommerce.com")
    name: str = Field(..., example="Admin")
    tenants: List[str] = Field(default_factory=lambda: ["ecommerce_demo", "ecommerce_prod"])
    plan: str = Field(default="free", example="free")

    class Config:
        populate_by_name = True

class LoginRequest(BaseModel):
    email: str = Field(..., example="admin@ecommerce.com")
    password: str = Field(..., min_length=4, example="admin123")
    tenant_id: Optional[str] = Field(None, example="ecommerce_demo", description="Tenant inicial desejado")

class CreateUserRequest(BaseModel):
    email: str = Field(..., example="novo.usuario@ecommerce.com")
    password: str = Field(..., min_length=4, example="senha123")
    name: str = Field(..., example="Novo Usuário")
    tenants: Optional[List[str]] = Field(default=None, example=["ecommerce_demo", "ecommerce_prod"])

class UpdateUserRequest(BaseModel):
    name: Optional[str] = Field(None, example="Nome Atualizado")
    password: Optional[str] = Field(None, min_length=4, example="novaSenha123")
    tenants: Optional[List[str]] = Field(None, example=["ecommerce_demo", "ecommerce_prod"])

class UserInfo(BaseModel):
    id: str
    email: str
    name: str

class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    tenants: List[str]
    created_at: Optional[datetime] = None

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserInfo
    tenants: List[str]

class LogoutResponse(BaseModel):
    message: str
