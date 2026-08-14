from fastapi import APIRouter

from app.features.shopify.routers import (
    shopify_bulk_router,
    shopify_inventory_router,
    shopify_oauth_router,
    shopify_product_router,
    shopify_webhook_router,
)

router = APIRouter()

router.include_router(shopify_oauth_router)
router.include_router(shopify_webhook_router)
router.include_router(shopify_product_router)
router.include_router(shopify_inventory_router)
router.include_router(shopify_bulk_router)

__all__ = ["router"]
