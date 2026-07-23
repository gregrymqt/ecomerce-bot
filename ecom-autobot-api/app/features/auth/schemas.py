from pydantic import BaseModel, Field
from typing import List, Optional

class LoginRequest(BaseModel):
    email: str = Field(..., example="admin@ecommerce.com")
    password: str = Field(..., min_length=4, example="admin123")
    tenant_id: Optional[str] = Field(None, example="ecommerce_demo", description="Tenant inicial desejado")

class UserInfo(BaseModel):
    id: str
    email: str
    name: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserInfo
    tenants: List[str]

class LogoutResponse(BaseModel):
    message: str
