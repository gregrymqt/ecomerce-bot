import logging
import os
from typing import Any, Dict, Optional
import httpx

from app.core.config.settings import settings

logger = logging.getLogger(__name__)


class EmailService:
    """
    Serviço de Lógica de Negócio para Envio de E-mails Transacionais (DDD Domain/Application Service).
    Responsável por renderizar templates HTML via Jinja2 e realizar requisições HTTP para a API do Resend,
    com fallback seguro em log caso a API Key não esteja configurada.
    """

    def __init__(self) -> None:
        self.api_key = settings.RESEND_API_KEY
        self.from_email = settings.EMAIL_FROM

    def _render_template(self, template_name: str, context: Dict[str, Any]) -> str:
        """
        Renderiza o template HTML localizado na pasta app/features/emails/templates via Jinja2.
        Em caso de ausência do arquivo, gera um layout HTML responsivo de fallback.
        """
        base_dir = os.path.dirname(os.path.dirname(__file__))
        template_dir = os.path.join(base_dir, "templates")
        template_path = os.path.join(template_dir, template_name)

        if os.path.exists(template_path):
            try:
                from jinja2 import Environment, FileSystemLoader
                env = Environment(loader=FileSystemLoader(template_dir))
                tmpl = env.get_template(template_name)
                return tmpl.render(**context)
            except Exception as err:
                logger.warning(f"[EmailService] Erro ao renderizar template Jinja2 '{template_name}': {err}")

        # Fallback de HTML responsivo padrão
        user_name = context.get("user_name", "Cliente")
        tenant_id = context.get("tenant_id", "default")
        items_html = "".join(f"<li><strong>{k}:</strong> {v}</li>" for k, v in context.items() if k not in {"user_name", "tenant_id"})

        return f"""
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0f172a; color: #f8fafc; padding: 24px; }}
                .card {{ background-color: #1e293b; border-radius: 12px; padding: 24px; max-width: 600px; margin: 0 auto; border: 1px solid #334155; }}
                .header {{ border-bottom: 1px solid #334155; padding-bottom: 16px; margin-bottom: 16px; }}
                .title {{ color: #38bdf8; font-size: 20px; font-weight: bold; }}
                .content {{ font-size: 14px; line-height: 1.6; color: #cbd5e1; }}
                .footer {{ margin-top: 24px; font-size: 12px; color: #64748b; text-align: center; }}
            </style>
        </head>
        <body>
            <div class="card">
                <div class="header">
                    <div class="title">ECom AutoBot</div>
                </div>
                <div class="content">
                    <p>Olá, <strong>{user_name}</strong>!</p>
                    <p>Você tem uma nova notificação do seu robô de e-commerce (Organização: <code>{tenant_id}</code>):</p>
                    <ul>
                        {items_html}
                    </ul>
                </div>
                <div class="footer">
                    ECom AutoBot &copy; 2026 — Automação Inteligente para E-Commerce
                </div>
            </div>
        </body>
        </html>
        """

    async def send_email(
        self,
        to_email: str,
        subject: str,
        template_name: str,
        context: Dict[str, Any],
    ) -> bool:
        """
        Envia um e-mail transacional para o destinatário usando Resend API ou fallback em log.
        """
        if not to_email:
            logger.warning("[EmailService] Endereço de e-mail de destino inválido.")
            return False

        html_content = self._render_template(template_name, context)

        if self.api_key:
            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    resp = await client.post(
                        "https://api.resend.com/emails",
                        headers={
                            "Authorization": f"Bearer {self.api_key}",
                            "Content-Type": "application/json",
                        },
                        json={
                            "from": self.from_email,
                            "to": [to_email],
                            "subject": subject,
                            "html": html_content,
                        },
                    )

                if resp.status_code in (200, 201):
                    logger.info(f"✉️ [EmailService] E-mail enviado com sucesso via Resend para '{to_email}' | Assunto: '{subject}'")
                    return True
                else:
                    logger.error(f"❌ [EmailService] Erro na API do Resend ({resp.status_code}): {resp.text}")
                    return False
            except Exception as err:
                logger.error(f"💥 [EmailService] Falha na comunicação HTTP com Resend: {err}")
                return False

        logger.info(
            f"📧 [EmailService - Modo Simulação/Dev] E-mail enviado ficticiamente para '{to_email}' | Assunto: '{subject}' | Template: '{template_name}'"
        )
        return True


email_service = EmailService()
