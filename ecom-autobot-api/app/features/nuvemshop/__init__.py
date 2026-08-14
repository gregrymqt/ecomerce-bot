from app.features.nuvemshop.domain import NuvemshopCredentials
from app.features.nuvemshop.infrastructure import (
    NuvemshopBaseClient,
    NuvemshopCategoryClient,
    NuvemshopClient,
    NuvemshopImageClient,
    NuvemshopProductClient,
    NuvemshopStockClient,
    NuvemshopWebhookClient,
)
from app.features.nuvemshop.repositories import NuvemshopRepository
from app.features.nuvemshop.schemas import (
    InventoryLevelSchema,
    NuvemshopBatchStockPriceItem,
    NuvemshopImageRequest,
    NuvemshopInventoryLevelItem,
    NuvemshopInventoryLevelListResponse,
    NuvemshopLocalizedString,
    NuvemshopLocationAddress,
    NuvemshopLocationResponse,
    NuvemshopProductRequest,
    NuvemshopProductUpdatePayload,
    NuvemshopStockUpdateBatchRequest,
    NuvemshopStockUpdateItem,
    NuvemshopVariantRequest,
)
from app.features.nuvemshop.services import (
    NuvemshopCategoryService,
    NuvemshopImageService,
    NuvemshopOAuthService,
    NuvemshopProductService,
    NuvemshopService,
    NuvemshopStockService,
    NuvemshopWebhookService,
)
from app.features.nuvemshop.workers import NuvemshopLocationWorker

__all__ = [
    # Domain
    "NuvemshopCredentials",
    # Repositories
    "NuvemshopRepository",
    # Infrastructure Clients
    "NuvemshopClient",
    "NuvemshopBaseClient",
    "NuvemshopStockClient",
    "NuvemshopProductClient",
    "NuvemshopImageClient",
    "NuvemshopCategoryClient",
    "NuvemshopWebhookClient",
    # Schemas
    "NuvemshopLocalizedString",
    "NuvemshopVariantRequest",
    "NuvemshopImageRequest",
    "NuvemshopProductRequest",
    "NuvemshopBatchStockPriceItem",
    "NuvemshopProductUpdatePayload",
    "NuvemshopLocationAddress",
    "NuvemshopLocationResponse",
    "InventoryLevelSchema",
    "NuvemshopInventoryLevelItem",
    "NuvemshopInventoryLevelListResponse",
    "NuvemshopStockUpdateItem",
    "NuvemshopStockUpdateBatchRequest",
    # Services
    "NuvemshopService",
    "NuvemshopProductService",
    "NuvemshopStockService",
    "NuvemshopWebhookService",
    "NuvemshopCategoryService",
    "NuvemshopOAuthService",
    "NuvemshopImageService",
    # Workers
    "NuvemshopLocationWorker",
]
