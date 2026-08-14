from fastapi import APIRouter

from app.features.checkout.order_router import order_router
from app.features.checkout.payment_router import payment_router
from app.features.checkout.refund_router import refund_router

router = APIRouter()

router.include_router(payment_router)
router.include_router(order_router)
router.include_router(refund_router)