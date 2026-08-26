"""
Registro central e exportação global de modelos SQLAlchemy ativos da aplicação.
Este arquivo garante que o Base.metadata do Alembic e do SQLAlchemy contenha
todos os modelos do sistema e desativa modelos legados.
"""

from app.core.config.database import Base

# Modelos do módulo AI Enrichment (Restantes)
from app.features.ai_enrichment.domain.models import LLMUsageLogModel

# Modelos do módulo Telemetria (Restantes)
from app.core.telemetry.models import RobotActivityModel, TokenTelemetryModel

__all__ = [
    "Base",
    "LLMUsageLogModel",
    "RobotActivityModel",
    "TokenTelemetryModel",
]
