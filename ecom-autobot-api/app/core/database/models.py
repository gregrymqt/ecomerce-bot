"""
Registro central e exportação global de modelos SQLAlchemy ativos da aplicação.
Este arquivo garante que o Base.metadata do Alembic e do SQLAlchemy contenha
todos os modelos do sistema e desativa modelos legados (SubscriptionModel, PlanModel, AIKeyModel).
"""

from app.core.config.database import Base

# Modelos do módulo Wallet (Carteira Pré-paga)
from app.features.wallet.domain.models import (
    CreditTransactionModel,
    TransactionType,
    WalletModel,
)

# Modelos do módulo Auth
from app.features.auth.domain.models import RoleModel, UserModel

# Modelos do módulo Products & Config
from app.features.products.domain.models import (
    ProductModel,
    RateLimitModel,
    ScrapingMetadataModel,
    TenantConfigModel,
)

# Modelos do módulo Checkout
from app.features.checkout.domain.models import OrderItemModel, OrderModel

# Modelos do módulo AI Enrichment
from app.features.ai_enrichment.domain.models import LLMUsageLogModel

# Modelos do módulo System / Telemetria
from app.features.system.domain.models import (
    RobotActivityModel,
    TokenTelemetryModel,
)

# NOTA: Modelos legados desativados/removidos das referências globais:
# - SubscriptionModel (app.features.subscriptions.domain.models)
# - PlanModel (app.features.plans.domain.models)
# - AIKeyModel (Obsoleto / substituído por BYOK no TenantConfigModel)

__all__ = [
    "Base",
    # Wallet (Ativo)
    "WalletModel",
    "CreditTransactionModel",
    "TransactionType",
    # Auth
    "RoleModel",
    "UserModel",
    # Products
    "ProductModel",
    "TenantConfigModel",
    "RateLimitModel",
    "ScrapingMetadataModel",
    # Checkout
    "OrderModel",
    "OrderItemModel",
    # AI Enrichment
    "LLMUsageLogModel",
    # System
    "RobotActivityModel",
    "TokenTelemetryModel",
]
