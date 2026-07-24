import uuid
from sqlalchemy import Column, DateTime, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func

from app.core.config.database import Base


class ProductModel(Base):
    __tablename__ = "products"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = Column(String(100), nullable=False, index=True)
    sku = Column(String(100), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    status = Column(String(50), nullable=False, default="Raw", index=True)

    # JSONB substitui os subdocumentos complexos do Mongo (imagens, variações, preços)
    raw_payload = Column(JSONB, nullable=True)
    ai_enriched_data = Column(JSONB, nullable=True)  # Dados refinados pela LLM

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class TenantConfigModel(Base):
    __tablename__ = "tenant_configs"

    tenant_id = Column(String(100), primary_key=True)
    # BYOK: Armazena chaves de API criptografadas por AES-256 GCM
    encrypted_keys = Column(JSONB, nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class RateLimitModel(Base):
    __tablename__ = "demo_rate_limits"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    ip = Column(String(64), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class ScrapingMetadataModel(Base):
    __tablename__ = "scraping_metadata"

    domain = Column(String(255), primary_key=True)
    consecutive_failures = Column(JSONB, nullable=True)
    silenced_until = Column(DateTime(timezone=True), nullable=True)
