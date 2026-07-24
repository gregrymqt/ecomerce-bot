from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field


class CreateUserRequest(BaseModel):
    email: str = Field(..., example="novo.usuario@ecommerce.com")
    password: str = Field(..., min_length=4, example="senha123")
    name: str = Field(..., example="Novo Usuário")
    role: Optional[str] = Field(default="user", example="ecommerce", description="Papel: user, ecommerce ou admin")
    tenants: Optional[List[str]] = Field(default=None, example=["ecommerce_demo", "ecommerce_prod"])


class UpdateUserRequest(BaseModel):
    name: Optional[str] = Field(None, example="Nome Atualizado")
    password: Optional[str] = Field(None, min_length=4, example="novaSenha123")
    role: Optional[str] = Field(None, example="admin")
    tenants: Optional[List[str]] = Field(None, example=["ecommerce_demo", "ecommerce_prod"])


class RoleResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        populate_by_name = True


class UserInfo(BaseModel):
    id: str
    email: str
    name: str
    role: str = "user"


class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    role: str = "user"
    tenants: List[str]
    created_at: Optional[datetime] = None
