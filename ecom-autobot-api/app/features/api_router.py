from fastapi import APIRouter, Depends
from app.core.security.rate_limiter import rate_limit_dependency

api_router = APIRouter(dependencies=[Depends(rate_limit_dependency(times=120, seconds=60))])

# Register core application routers (none left, all migrated to C#!)