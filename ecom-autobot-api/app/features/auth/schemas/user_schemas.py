from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


class CreateUserRequest(BaseModel):
    email: str = Field(..., json_schema_extra={"example": "novo.usuario@ecommerce.com"})
    password: str = Field(..., min_length=4, json_schema_extra={"example": "senha123"})
    name: str = Field(..., json_schema_extra={"example": "Novo Usuário"})
    role: Optional[str] = Field(default="user", description="Papel: user, ecommerce ou admin", json_schema_extra={"example": "ecommerce"})
    tenants: Optional[List[str]] = Field(default=None, json_schema_extra={"example": ["ecommerce_demo", "ecommerce_prod"]})


class UpdateUserRequest(BaseModel):
    name: Optional[str] = Field(None, json_schema_extra={"example": "Nome Atualizado"})
    password: Optional[str] = Field(None, min_length=4, json_schema_extra={"example": "novaSenha123"})
    role: Optional[str] = Field(None, json_schema_extra={"example": "admin"})
    tenants: Optional[List[str]] = Field(None, json_schema_extra={"example": ["ecommerce_demo", "ecommerce_prod"]})


class RoleResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    created_at: Optional[datetime] = None

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)


class UserInfo(BaseModel):
    id: str
    email: str
    name: str
    role: str = "user"

    model_config = ConfigDict(from_attributes=True)


class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    role: str = "user"
    tenants: List[str]
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
