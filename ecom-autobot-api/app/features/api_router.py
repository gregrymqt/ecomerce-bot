from fastapi import APIRouter

from app.features.auth.router import router as auth_router
from app.features.shopify.router import router as shopify_router
from app.features.nuvemshop.router import router as nuvemshop_router
from app.features.scraper.router import router as scraper_router
from app.features.system.router import router as system_router
from app.features.plans.router import router as plans_router
from app.features.mercadopago.router import router as webhook_router
from app.features.subscriptions.router import router as subscriptions_router  
from app.features.checkout.router import router as checkout_router
from app.features.products.router import router as products_router
from app.features.ai_keys.router import router as ai_keys_router
from app.features.settings.router import router as settings_router

api_router = APIRouter()

api_router.include_router(auth_router)
api_router.include_router(shopify_router)
api_router.include_router(nuvemshop_router)
api_router.include_router(scraper_router)
api_router.include_router(system_router)
api_router.include_router(plans_router)
api_router.include_router(webhook_router)
api_router.include_router(subscriptions_router)  
api_router.include_router(checkout_router)
api_router.include_router(products_router)
api_router.include_router(ai_keys_router)
api_router.include_router(settings_router)