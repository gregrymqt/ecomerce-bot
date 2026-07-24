from typing import Optional
from pydantic import BaseModel, Field, EmailStr


class AddressSchema(BaseModel):
    zip_code: str = Field(..., max_length=20, example="06233-903")
    street_name: str = Field(..., max_length=200)
    street_number: str = Field(..., max_length=50)
    neighborhood: str = Field(..., max_length=100)
    city: str = Field(..., max_length=100)
    state: str = Field(..., min_length=2, max_length=2, description="UF com 2 letras")
    complement: Optional[str] = Field(None, max_length=100)


class PayerIdentificationSchema(BaseModel):
    type: str = Field(..., example="CPF", description="Tipo de documento (CPF/CNPJ)")
    number: str = Field(..., example="19119119100")


class PayerPhoneSchema(BaseModel):
    area_code: str = Field(..., max_length=5, example="11")
    number: str = Field(..., max_length=20, example="987654321")


class PayerInputSchema(BaseModel):
    email: EmailStr
    entity_type: Optional[str] = Field("individual", example="individual")
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    identification: Optional[PayerIdentificationSchema] = None
    phone: Optional[PayerPhoneSchema] = None
    address: Optional[AddressSchema] = None


class ShipmentInputSchema(BaseModel):
    address: AddressSchema


class OrderItemSchema(BaseModel):
    title: str = Field(..., max_length=150)
    unit_price: str = Field(..., description="Preço unitário formatado (ex: '24.50')")
    quantity: int = Field(..., ge=1)
    description: Optional[str] = Field(None, max_length=100)
    external_code: Optional[str] = None
    picture_url: Optional[str] = None
    category_id: Optional[str] = None
    type: Optional[str] = None
    warranty: Optional[bool] = False
    event_date: Optional[str] = None


class SponsorInputSchema(BaseModel):
    id: Optional[str] = None


class IntegrationDataInputSchema(BaseModel):
    integrator_id: Optional[str] = None
    platform_id: Optional[str] = None
    corporation_id: Optional[str] = None
    sponsor: Optional[SponsorInputSchema] = None
