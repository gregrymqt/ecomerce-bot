"""
Módulo de E-mails Transacionais (DDD) - ECom AutoBot
Contém o serviço de renderização (EmailTemplateService), o produtor de mensageria (EmailDispatcherService),
o serviço de webhook (EmailWebhookService) e o consumidor de lote RabbitMQ (EmailBatchWorker).
"""

from app.features.emails.services import (
    EmailDispatcherService,
    EmailTemplateService,
    EmailWebhookService,
    email_dispatcher,
    email_webhook_service,
    template_service,
)
from app.features.emails.workers import EmailBatchWorker, email_batch_worker

EmailWorker = EmailBatchWorker

__all__ = [
    "email_dispatcher",
    "EmailDispatcherService",
    "template_service",
    "EmailTemplateService",
    "email_webhook_service",
    "EmailWebhookService",
    "email_batch_worker",
    "EmailBatchWorker",
    "EmailWorker",
]
