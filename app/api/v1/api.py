from fastapi import APIRouter

from app.api.v1.routers.shopify import router as shopify_router
from app.api.v1.routers.nuvemshop import router as nuvemshop_router
from app.api.v1.routers.system import router as system_router
from app.api.v1.routers.ai_scraper import router as ai_scraper_router

router = APIRouter()

router.include_router(shopify_router)
router.include_router(nuvemshop_router)
router.include_router(system_router)
router.include_router(ai_scraper_router)
