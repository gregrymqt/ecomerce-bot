from fastapi import APIRouter

from app.features.nuvemshop.routers import (
    nuvemshop_category_router,
    nuvemshop_oauth_router,
    nuvemshop_product_router,
    nuvemshop_stock_router,
    nuvemshop_webhook_router,
)

router = APIRouter()

router.include_router(nuvemshop_oauth_router)
router.include_router(nuvemshop_webhook_router)
router.include_router(nuvemshop_stock_router)
router.include_router(nuvemshop_product_router)
router.include_router(nuvemshop_category_router)
