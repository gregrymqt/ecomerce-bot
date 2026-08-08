import uuid
from sqlalchemy import Column, DateTime, String
from sqlalchemy.sql import func

from app.core.config.database import Base


class EnterpriseLeadModel(Base):
    """
    Representação da tabela 'enterprise_leads' no PostgreSQL.
    Armazena os leads capturados através do Fake Door de SSO Enterprise.
    """
    __tablename__ = "enterprise_leads"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String(255), nullable=False, index=True)
    company_name = Column(String(255), nullable=False)
    team_size = Column(String(50), nullable=True)
    phone = Column(String(50), nullable=True)
    notes = Column(String(500), nullable=True)
    ip_address = Column(String(64), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
