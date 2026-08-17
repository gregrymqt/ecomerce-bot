from app.features.mercadopago.workers.webhook_worker import (
    WebhookDispatcherWorker,
    webhook_dispatcher_worker,
)

AsyncWebhookWorker = WebhookDispatcherWorker

__all__ = [
    "WebhookDispatcherWorker",
    "webhook_dispatcher_worker",
    "AsyncWebhookWorker",
]
