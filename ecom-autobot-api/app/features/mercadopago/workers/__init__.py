from app.features.mercadopago.workers.webhook_worker import WebhookDispatcherWorker

AsyncWebhookWorker = WebhookDispatcherWorker

__all__ = ["WebhookDispatcherWorker", "AsyncWebhookWorker"]
