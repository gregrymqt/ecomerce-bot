import logging
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
import httpx
from app.core.config.settings import settings

logger = logging.getLogger(__name__)

COLOR_CRITICAL = 0xEF4444  # Vermelho
COLOR_WARNING = 0xF59E0B   # Amarelo
COLOR_INFO = 0x10B981      # Verde


class DiscordAlerter:
    """
    Serviço assíncrono para disparo de alertas e notificações para o Discord Webhook
    no microsserviço Worker (Scraping, IA e Machine Learning).
    """

    def __init__(self, webhook_url: Optional[str] = None):
        self.webhook_url = webhook_url or settings.DISCORD_WEBHOOK_URL

    async def send_critical_alert(
        self,
        title: str,
        description: str,
        error: Optional[Exception] = None,
        source: str = "Worker AI/ML"
    ) -> None:
        fields: List[Dict[str, Any]] = [
            {"name": "Origem", "value": source, "inline": True},
            {"name": "Ambiente", "value": settings.ENVIRONMENT.upper(), "inline": True}
        ]

        if error:
            error_str = str(error)
            if len(error_str) > 1000:
                error_str = error_str[:1000] + "... [truncado]"
            fields.append({"name": "Erro", "value": f"```{error_str}```", "inline": False})

        await self._send_embed(
            title=f"🚨 [FALHA WORKER] {title}",
            description=description,
            color=COLOR_CRITICAL,
            fields=fields
        )

    async def send_warning_alert(
        self,
        title: str,
        description: str,
        source: str = "Worker AI/ML"
    ) -> None:
        fields: List[Dict[str, Any]] = [
            {"name": "Origem", "value": source, "inline": True},
            {"name": "Ambiente", "value": settings.ENVIRONMENT.upper(), "inline": True}
        ]

        await self._send_embed(
            title=f"⚠️ [ALERTA WORKER] {title}",
            description=description,
            color=COLOR_WARNING,
            fields=fields
        )

    async def send_info_alert(
        self,
        title: str,
        description: str,
        source: str = "Worker AI/ML"
    ) -> None:
        fields: List[Dict[str, Any]] = [
            {"name": "Origem", "value": source, "inline": True},
            {"name": "Ambiente", "value": settings.ENVIRONMENT.upper(), "inline": True}
        ]

        await self._send_embed(
            title=f"ℹ️ [INFO WORKER] {title}",
            description=description,
            color=COLOR_INFO,
            fields=fields
        )

    async def _send_embed(
        self,
        title: str,
        description: str,
        color: int,
        fields: List[Dict[str, Any]]
    ) -> None:
        url = self.webhook_url or settings.DISCORD_WEBHOOK_URL
        if not url:
            return

        payload = {
            "username": "E-commerce Bot Worker Sentinel",
            "avatar_url": "https://cdn-icons-png.flaticon.com/512/4712/4712035.png",
            "embeds": [
                {
                    "title": title[:250],
                    "description": description[:2000],
                    "color": color,
                    "fields": fields,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "footer": {
                        "text": "EcommerceBot Worker Telemetry & Alerting"
                    }
                }
            ]
        }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(url, json=payload)
                if response.status_code >= 400:
                    logger.warning(f"Discord Webhook retornou status {response.status_code}: {response.text}")
        except Exception as ex:
            # Falhas no envio de alerta não devem interromper o processamento de mensagens
            logger.warning(f"Falha ao enviar alerta para Discord Webhook: {ex}")


# Instância global reutilizável
discord_alerter = DiscordAlerter()
