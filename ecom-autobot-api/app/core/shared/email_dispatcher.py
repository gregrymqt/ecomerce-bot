"""
Re-export para compatibilidade com app.features.emails.services.email_dispatcher
"""

from app.features.emails.services.email_dispatcher import email_dispatcher, EmailDispatcherService

__all__ = ["email_dispatcher", "EmailDispatcherService"]