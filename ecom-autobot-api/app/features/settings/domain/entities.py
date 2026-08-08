from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional


@dataclass
class AiSettingsEntity:
    """Entidade de domínio para diretrizes de IA."""
    tone_of_voice: str = "persuasivo"
    target_language: str = "pt-BR"
    seo_tags_enabled: bool = True
    custom_instructions: Optional[str] = None


@dataclass
class PricingSettingsEntity:
    """Entidade de domínio para regras de precificação."""
    margin_percentage: float = 0.0
    round_cents: bool = True


@dataclass
class StoreProfileEntity:
    """Entidade de domínio para perfil do lojista."""
    store_name: Optional[str] = None
    niche: Optional[str] = None
    support_email: Optional[str] = None


@dataclass
class TenantSettingsEntity:
    """Agregado de domínio para todas as configurações operacionais do tenant."""
    tenant_id: str
    ai_settings: AiSettingsEntity = field(default_factory=AiSettingsEntity)
    pricing_settings: PricingSettingsEntity = field(default_factory=PricingSettingsEntity)
    store_profile: StoreProfileEntity = field(default_factory=StoreProfileEntity)
    updated_at: Optional[datetime] = None
