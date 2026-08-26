from fastapi import APIRouter, Depends
from app.core.security.rate_limiter import rate_limit_dependency

from app.features.nuvemshop.router import router as nuvemshop_router

api_router = APIRouter(dependencies=[Depends(rate_limit_dependency(times=120, seconds=60))])

# Register core application routers
api_router.include_router(nuvemshop_router)