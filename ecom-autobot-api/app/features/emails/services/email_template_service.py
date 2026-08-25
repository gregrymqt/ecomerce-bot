import html
import os
from typing import Any, Dict, Tuple
from app.core.shared.logger import get_logger

logger = get_logger("EmailTemplateService")

TEMPLATE_REGISTRY: Dict[str, Dict[str, str]] = {
    "USER_WELCOME": {
        "template": "welcome.html",
        "subject": "Bem-vindo ao ECom AutoBot! 🚀",
    },
    "RECHARGE_CONFIRMED": {
        "template": "recharge_approved.html",
        "subject": "Sua recarga de créditos foi confirmada! 🎉",
    },
    "LOW_BALANCE_ALERT": {
        "template": "low_balance.html",
        "subject": "Atenção: Saldo de créditos baixo ⚠️",
    },
    "ZERO_BALANCE_BLOCK": {
        "template": "low_balance.html",
        "subject": "Aviso: Tentativa de uso com saldo zerado 🚨",
    },
    "BATCH_PROCESSING_COMPLETED": {
        "template": "batch_completed.html",
        "subject": "Seu lote de produtos foi processado! 🚀",
    },
    "EXTERNAL_CREDENTIAL_ERROR": {
        "template": "integration_error.html",
        "subject": "Falha na integração com e-commerce 🚨",
    },
    "BYOK_KEY_INVALID": {
        "template": "integration_error.html",
        "subject": "Sua chave de API de IA precisa de atenção 🚨",
    },
}


class EmailTemplateService:
    """Serviço responsável por resolver assuntos e renderizar o layout HTML via Jinja2 ou fallback."""

    def __init__(self) -> None:
        self.templates_dir = os.path.join(
            os.path.dirname(os.path.dirname(__file__)), "templates"
        )

    def resolve_event(self, event_name: str) -> Tuple[str, str]:
        """Retorna uma tupla (template_filename, subject_default) a partir do evento."""
        config = TEMPLATE_REGISTRY.get(event_name)
        if config:
            return config["template"], config["subject"]
        return "default.html", f"Notificação ECom AutoBot - {event_name}"

    def render(self, template_name: str, context: Dict[str, Any]) -> str:
        """Renderiza o arquivo HTML na pasta templates ou gera fallback estruturado."""
        template_path = os.path.join(self.templates_dir, template_name)

        if os.path.exists(template_path):
            try:
                from jinja2 import Environment, FileSystemLoader, select_autoescape
                env = Environment(  # nosemgrep: python.flask.security.xss.audit.direct-use-of-jinja2.direct-use-of-jinja2
                    loader=FileSystemLoader(self.templates_dir),
                    autoescape=select_autoescape(["html", "xml", "htm"]),
                )
                tmpl = env.get_template(template_name)
                return tmpl.render(**context)  # nosemgrep: python.flask.security.xss.audit.direct-use-of-jinja2.direct-use-of-jinja2
            except Exception as err:
                logger.warning(f"[TemplateService] Falha ao renderizar Jinja2 '{template_name}': {err}. Usando fallback.")

        # Fallback de HTML responsivo padrão com escape seguro
        user_name = html.escape(str(context.get("user_name", "Cliente")))
        tenant_id = html.escape(str(context.get("tenant_id", "default")))
        items_html = "".join(
            f"<li><strong>{html.escape(str(k))}:</strong> {html.escape(str(v))}</li>"
            for k, v in context.items()
            if k not in {"user_name", "tenant_id"}
        )

        return f"""
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0f172a; color: #f8fafc; padding: 24px; }}
                .card {{ background-color: #1e293b; border-radius: 12px; padding: 24px; max-width: 600px; margin: 0 auto; border: 1px solid #334155; }}
                .title {{ color: #38bdf8; font-size: 20px; font-weight: bold; margin-bottom: 16px; }}
                .content {{ font-size: 14px; line-height: 1.6; color: #cbd5e1; }}
                .footer {{ margin-top: 24px; font-size: 12px; color: #64748b; text-align: center; }}
            </style>
        </head>
        <body>
            <div class="card">
                <div class="title">ECom AutoBot</div>
                <div class="content">
                    <p>Olá, <strong>{user_name}</strong>!</p>
                    <p>Atualização referente à organização <code>{tenant_id}</code>:</p>
                    <ul>{items_html}</ul>
                </div>
                <div class="footer">ECom AutoBot &copy; 2026</div>
            </div>
        </body>
        </html>
        """


template_service = EmailTemplateService()