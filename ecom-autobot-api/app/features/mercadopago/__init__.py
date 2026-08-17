"""
Módulo de Integração com Mercado Pago (DDD) - ECom AutoBot
Garante recebimento de webhooks, roteamento de eventos, consulta de pagamentos e assinaturas.
"""

from app.features.mercadopago.domain import (
    MercadoPagoAPIError,
    MercadoPagoDomainException,
    MercadoPagoSignatureError,
    MercadoPagoWebhookLog,
    MercadoPagoWebhookProcessingError,
    MercadoPagoWebhookStatus,
    verify_mercadopago_signature,
)
from app.features.mercadopago.infrastructure import MercadoPagoClient
from app.features.mercadopago.repositories import (
    MercadoPagoRepository,
    mercadopago_repository,
)
from app.features.mercadopago.schemas import (
    BaseNotificationHandler,
    MPIdentificationDTO,
    MPPayerDTO,
    MPPaymentCreateRequest,
    MPPaymentResponse,
    MPPreapprovalRequest,
    MPPreapprovalResponse,
    MercadoPagoDataDTO,
    MercadoPagoNotificationPayload,
    WebhookEventPayload,
)
from app.features.mercadopago.services import (
    MercadoPagoWebhookService,
    NotificationDispatcher,
    PaymentApprovedService,
    mercadopago_webhook_service,
)
from app.features.mercadopago.workers import (
    AsyncWebhookWorker,
    WebhookDispatcherWorker,
    webhook_dispatcher_worker,
)

__all__ = [
    # Domain
    "verify_mercadopago_signature",
    "MercadoPagoWebhookLog",
    "MercadoPagoWebhookStatus",
    "MercadoPagoDomainException",
    "MercadoPagoSignatureError",
    "MercadoPagoAPIError",
    "MercadoPagoWebhookProcessingError",
    # Infrastructure
    "MercadoPagoClient",
    # Repositories
    "MercadoPagoRepository",
    "mercadopago_repository",
    # Schemas
    "MercadoPagoDataDTO",
    "MercadoPagoNotificationPayload",
    "BaseNotificationHandler",
    "WebhookEventPayload",
    "MPIdentificationDTO",
    "MPPayerDTO",
    "MPPaymentCreateRequest",
    "MPPaymentResponse",
    "MPPreapprovalRequest",
    "MPPreapprovalResponse",
    # Services
    "NotificationDispatcher",
    "PaymentApprovedService",
    "MercadoPagoWebhookService",
    "mercadopago_webhook_service",
    # Workers
    "AsyncWebhookWorker",
    "WebhookDispatcherWorker",
    "webhook_dispatcher_worker",
]
