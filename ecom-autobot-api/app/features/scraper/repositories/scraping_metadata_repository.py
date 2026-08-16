import logging
from typing import Optional, Tuple
from datetime import datetime, timezone, timedelta
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config.database import get_db
from app.features.products.domain.models import ScrapingMetadataModel

logger = logging.getLogger(__name__)


class ScrapingMetadataRepository:
    """
    Repositório assíncrono para manipulação da tabela de metadados de scraping por domínio.
    """

    def __init__(self, session: Optional[AsyncSession] = None):
        self.session = session

    async def _get_session(self) -> Tuple[AsyncSession, bool]:
        if self.session is not None:
            return self.session, False
        gen = get_db()
        session = await anext(gen)
        return session, True

    async def register_failure(self, domain: str) -> Tuple[int, Optional[datetime]]:
        """
        Incrementa o contador de falhas consecutivas do domínio e retorna a nova contagem e data de silenciamento.
        """
        session, owned = await self._get_session()
        try:
            meta = await session.get(ScrapingMetadataModel, domain)
            if meta is None:
                meta = ScrapingMetadataModel(domain=domain, consecutive_failures=1)
                session.add(meta)
            else:
                current = meta.consecutive_failures or 0
                meta.consecutive_failures = current + 1
            await session.commit()

            failures = meta.consecutive_failures or 1
            silenced_until = meta.silenced_until
            return failures, silenced_until
        except Exception as e:
            logger.error(f"[ScrapingMetadataRepository] Erro ao registrar falha para domínio '{domain}': {e}")
            if owned:
                await session.rollback()
            raise
        finally:
            if owned:
                await session.close()

    async def reset_failures(self, domain: str) -> None:
        """
        Zera a contagem de falhas consecutivas quando ocorre um scraping com sucesso.
        """
        session, owned = await self._get_session()
        try:
            meta = await session.get(ScrapingMetadataModel, domain)
            if meta is not None and (meta.consecutive_failures or 0) > 0:
                meta.consecutive_failures = 0
                await session.commit()
        except Exception as e:
            logger.error(f"[ScrapingMetadataRepository] Erro ao resetar falhas para domínio '{domain}': {e}")
            if owned:
                await session.rollback()
            raise
        finally:
            if owned:
                await session.close()

    async def set_silenced_until(self, domain: str, duration_hours: int = 1) -> None:
        """
        Define o timestamp de silenciamento de alertas no Discord para o domínio especificado.
        """
        session, owned = await self._get_session()
        try:
            meta = await session.get(ScrapingMetadataModel, domain)
            if meta is not None:
                meta.silenced_until = datetime.now(timezone.utc) + timedelta(hours=duration_hours)
                await session.commit()
        except Exception as e:
            logger.error(f"[ScrapingMetadataRepository] Erro ao definir silenciamento para domínio '{domain}': {e}")
            if owned:
                await session.rollback()
            raise
        finally:
            if owned:
                await session.close()
