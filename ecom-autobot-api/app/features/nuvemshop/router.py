from app.features.nuvemshop import nuvemshop_category_router
from app.features.nuvemshop import nuvemshop_product_router
from app.features.nuvemshop import nuvemshop_stock_router
from app.features.nuvemshop import nuvemshop_webhook_router
from app.features.nuvemshop import nuvemshop_oauth_router
from fastapi import APIRouter


router = APIRouter()

router.include_router(nuvemshop_oauth_router)
router.include_router(nuvemshop_webhook_router)
router.include_router(nuvemshop_stock_router)
router.include_router(nuvemshop_product_router)
router.include_router(nuvemshop_category_router)
