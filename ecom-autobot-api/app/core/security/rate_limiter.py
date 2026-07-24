import logging
from datetime import datetime, timezone, timedelta
import fastapi
from sqlalchemy import select, func
from app.core.config.database import AsyncSessionLocal
from app.features.products.domain.models import RateLimitModel

logger = logging.getLogger(__name__)

async def check_demo_rate_limit(request: fastapi.Request):
    if not request.client or not request.client.host:
        client_ip = "unknown"
    else:
        client_ip = request.client.host

    one_hour_ago = datetime.now(timezone.utc) - timedelta(hours=1)

    async with AsyncSessionLocal() as session:
        stmt = (
            select(func.count())
            .select_from(RateLimitModel)
            .where(
                RateLimitModel.ip == client_ip,
                RateLimitModel.created_at >= one_hour_ago,
            )
        )
        count = (await session.execute(stmt)).scalar() or 0

        if count >= 5:
            logger.warning(f"Rate limit bloqueou o IP: {client_ip}. Requisições na última hora: {count}")
            raise fastapi.HTTPException(
                status_code=429,
                detail="Limite de demonstração excedido para o seu IP. Tente novamente mais tarde."
            )

        session.add(RateLimitModel(ip=client_ip))
        await session.commit()
