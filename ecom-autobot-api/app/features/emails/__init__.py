"""
Módulo de E-mails Transacionais (DDD) - ECom AutoBot
Contém o serviço de renderização (EmailService), o produtor de mensageria (EmailDispatcherService),
o consumidor de fila RabbitMQ (EmailWorker) e os templates HTML Jinja2.
"""

from app.features.emails.services.email_dispatcher import email_dispatcher, EmailDispatcherService
from app.features.emails.services.email_service import email_service, EmailService
from app.features.emails.workers.email_worker import EmailWorker

__all__ = [
    "email_dispatcher",
    "EmailDispatcherService",
    "email_service",
    "EmailService",
    "EmailWorker",
]
