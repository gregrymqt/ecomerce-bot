from fastapi import APIRouter, Depends
from app.core.security.rate_limiter import rate_limit_dependency

from app.features.shopify.router import router as shopify_router
from app.features.nuvemshop.router import router as nuvemshop_router
from app.features.system.router import router as system_router
from app.features.settings.router import router as settings_router

api_router = APIRouter(dependencies=[Depends(rate_limit_dependency(times=120, seconds=60))])

api_router.include_router(shopify_router)
api_router.include_router(nuvemshop_router)
api_router.include_router(system_router)
api_router.include_router(settings_router)