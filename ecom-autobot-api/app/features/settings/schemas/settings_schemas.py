from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class AiSettingsSchema(BaseModel):
    tone_of_voice: str = "persuasivo"
    target_language: str = "pt-BR"
    seo_tags_enabled: bool = True
    custom_instructions: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class PricingSettingsSchema(BaseModel):
    margin_percentage: float = 0.0
    round_cents: bool = True

    model_config = ConfigDict(from_attributes=True)


class StoreProfileSchema(BaseModel):
    store_name: Optional[str] = None
    niche: Optional[str] = None
    support_email: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class TenantSettingsResponse(BaseModel):
    tenant_id: str
    ai_settings: AiSettingsSchema = Field(default_factory=AiSettingsSchema)
    pricing_settings: PricingSettingsSchema = Field(default_factory=PricingSettingsSchema)
    store_profile: StoreProfileSchema = Field(default_factory=StoreProfileSchema)
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class TenantSettingsUpdate(BaseModel):
    ai_settings: Optional[AiSettingsSchema] = None
    pricing_settings: Optional[PricingSettingsSchema] = None
    store_profile: Optional[StoreProfileSchema] = None

    model_config = ConfigDict(from_attributes=True)
