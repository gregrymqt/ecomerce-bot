import os
import httpx
import logging
from datetime import datetime
from typing import Optional

from app.config.settings import settings

logger = logging.getLogger(__name__)

class NotificationService:
    """
    Serviço assíncrono para envio de notificações e alertas de engenharia.
    Atualmente suporta alertas críticos via Discord Webhook.
    """

    def __init__(self):
        self.discord_webhook_url = settings.DISCORD_WEBHOOK_URL

    async def send_discord_alert(self, domain: str, error_type: str, example_url: Optional[str] = None):
        """
        Envia um alerta formatado como Embed para o Discord.
        """
        if not self.discord_webhook_url:
            logger.warning("DISCORD_WEBHOOK_URL não configurada. Alerta não enviado.")
            return

        embed = {
            "title": "🚨 ALERTA: Falha Crítica de Scraping",
            "description": f"Detectamos múltiplas falhas consecutivas ao tentar processar o domínio **{domain}**. Possível bloqueio (WAF/Cloudflare) ou mudança drástica de layout.",
            "color": 16731051, # #FF4B4B em decimal
            "fields": [
                {
                    "name": "🌐 Domínio Afetado",
                    "value": domain,
                    "inline": True
                },
                {
                    "name": "⚠️ Tipo de Erro",
                    "value": error_type,
                    "inline": True
                }
            ],
            "footer": {
                "text": f"Ecommerce Bot System • {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
            }
        }

        if example_url:
            embed["fields"].append({
                "name": "🔗 URL de Exemplo (Última Falha)",
                "value": example_url,
                "inline": False
            })

        payload = {
            "embeds": [embed]
        }

        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                response = await client.post(self.discord_webhook_url, json=payload)
                response.raise_for_status()
                logger.info(f"Alerta Discord enviado com sucesso para falhas no domínio {domain}")
            except Exception as e:
                logger.error(f"Falha ao enviar alerta para o Discord: {e}")
