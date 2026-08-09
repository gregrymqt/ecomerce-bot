import logging
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.auth.domain.enterprise_lead_model import EnterpriseLeadModel
from app.features.auth.repositories.enterprise_lead_repository import EnterpriseLeadRepository
from app.features.auth.schemas.enterprise_lead_schema import (
    EnterpriseLeadRequest,
    EnterpriseLeadResponse,
)
from app.features.system.services.notification_service import NotificationService

logger = logging.getLogger(__name__)


class EnterpriseLeadService:
    """
    Serviço de aplicação para processar solicitações de leads do SSO Enterprise (Fake Door Test),
    efetuar persistência no PostgreSQL, registrar telemetria e enviar notificações.
    """

    def __init__(
        self,
        lead_repo: Optional[EnterpriseLeadRepository] = None,
        repository: Optional[EnterpriseLeadRepository] = None,
        notification_service: Optional[NotificationService] = None,
        session: Optional[AsyncSession] = None,
    ):
        self.lead_repo = lead_repo or repository or EnterpriseLeadRepository(session=session)
        self.notification_service = notification_service or NotificationService()

    async def register_lead(
        self,
        db: Optional[AsyncSession] = None,
        payload: Optional[EnterpriseLeadRequest] = None,
        ip_address: Optional[str] = None,
    ) -> EnterpriseLeadResponse:
        """
        Registra a solicitação do lead no banco, emite telemetria e notifica o time comercial.
        """
        if payload is None:
            raise ValueError("Payload de solicitação de lead não fornecido.")

        repo = EnterpriseLeadRepository(session=db) if db is not None else (self.lead_repo or EnterpriseLeadRepository())

        clean_email = payload.email.lower().strip()
        clean_company = payload.company_name.strip()

        lead_entity = EnterpriseLeadModel(
            email=clean_email,
            company_name=clean_company,
            team_size=payload.team_size.strip() if payload.team_size else None,
            phone=payload.phone.strip() if payload.phone else None,
            notes=payload.notes.strip() if payload.notes else None,
            ip_address=ip_address,
        )

        try:
            created = await repo.create_lead(lead_entity)
            lead_id = created.id
            created_at = created.created_at
        except Exception as err:
            logger.warning(
                f"Falha ao persistir lead Enterprise no banco de dados ({err}). Executando com resposta em memória."
            )
            import uuid
            from datetime import datetime, timezone
            lead_id = f"lead_{uuid.uuid4().hex[:12]}"
            created_at = datetime.now(timezone.utc)

        # Telemetria: Log estruturado de evento de interesse corporativo
        logger.info(
            f"[TELEMETRY / FAKE DOOR SSO] Lead Corporativo Registrado! "
            f"Email: {clean_email} | Empresa: {clean_company} | Time: {payload.team_size or 'N/I'} | IP: {ip_address or 'N/I'}"
        )

        # Envio de notificação ao Discord (caso configurado webhook)
        try:
            await self._send_discord_notification(clean_email, clean_company, payload.team_size, payload.phone)
        except Exception as notif_err:
            logger.warning(f"Erro ao disparar notificação Discord para lead Enterprise: {notif_err}")

        return EnterpriseLeadResponse(
            id=lead_id,
            email=clean_email,
            company_name=clean_company,
            message="Solicitação corporativa registrada com sucesso. Nosso time comercial entrará em contato em breve.",
            created_at=created_at,
        )

    async def _send_discord_notification(
        self,
        email: str,
        company: str,
        team_size: Optional[str],
        phone: Optional[str],
    ) -> None:
        if not self.notification_service.discord_webhook_url:
            return

        embed = {
            "title": "🏢 NOVO LEAD ENTERPRISE (SSO Fake Door)",
            "description": "Uma empresa solicitou contato para o Plano Corporativo / SSO Enterprise!",
            "color": 3447003,
            "fields": [
                {"name": "✉️ E-mail Corporativo", "value": email, "inline": True},
                {"name": "🏢 Empresa", "value": company, "inline": True},
                {"name": "👥 Tamanho da Equipe", "value": team_size or "Não informado", "inline": True},
                {"name": "📞 Telefone / WhatsApp", "value": phone or "Não informado", "inline": False},
            ],
        }
        payload = {"embeds": [embed]}

        import httpx
        async with httpx.AsyncClient(timeout=5.0) as client:
            await client.post(self.notification_service.discord_webhook_url, json=payload)
