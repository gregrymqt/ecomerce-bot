from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config.settings import settings
from app.core.security.crypto import decrypt_api_key
from app.core.shared.logger import get_logger
from app.features.ai_enrichment.domain.exceptions import (
    OpenRouterAPIError,
    OpenRouterRateLimitError,
)
from app.features.ai_enrichment.infrastructure.providers.openrouter_provider import (
    OpenRouterLLMProvider,
)
from app.features.ai_enrichment.schemas import (
    LLMCompletionRequest,
    LLMCompletionResponse,
)
from app.features.products.repositories.tenant_config_repository import (
    TenantConfigRepository,
)

logger = get_logger("LLMEngineRouter")


class LLMEngineRouter:
    """
    Serviço de roteamento de IA responsável por resolver a chave de API (BYOK do tenant vs. Chave Global)
    e orquestrar requisições assíncronas ao OpenRouter com lista de modelos em fallback encadeado.
    """

    def __init__(self, provider: Optional[OpenRouterLLMProvider] = None):
        self.provider = provider or OpenRouterLLMProvider()

    async def _resolve_tenant_key(self, tenant_id: str, db: AsyncSession) -> Optional[str]:
        """
        Busca e descriptografa a chave BYOK do OpenRouter para o tenant especificado.
        """
        try:
            repo = TenantConfigRepository(session=db)
            config = await repo.get(tenant_id)
            if config and config.encrypted_keys:
                encrypted_key = config.encrypted_keys.get("openrouter_api_key")
                if encrypted_key:
                    decrypted = decrypt_api_key(encrypted_key)
                    if decrypted and decrypted.strip():
                        return decrypted.strip()
        except Exception as e:
            logger.warning(f"[LLMEngineRouter] Erro ao obter chave BYOK do tenant '{tenant_id}': {e}")
        return None

    async def generate_completion(
        self,
        tenant_id: str,
        prompt_data: LLMCompletionRequest,
        db: AsyncSession,
    ) -> LLMCompletionResponse:
        """
        Gera uma conclusão via OpenRouter com resolução dinâmica de chaves (BYOK tenant -> Chave mestre global).
        """
        tenant_key = await self._resolve_tenant_key(tenant_id=tenant_id, db=db)
        global_key = (settings.OPENROUTER_API_KEY or "").strip()

        # 1. Tentar executar via chave BYOK do tenant (se cadastrada)
        if tenant_key:
            logger.info(f"[LLMEngineRouter] Tentando chamada com chave BYOK do tenant '{tenant_id}'.")
            try:
                return await self.provider.generate_completion(
                    request=prompt_data,
                    api_key=tenant_key,
                )
            except OpenRouterAPIError as exc:
                if exc.status_code in {401, 402}:
                    logger.warning(
                        f"[LLMEngineRouter] Chave BYOK do tenant '{tenant_id}' falhou com status HTTP {exc.status_code}. "
                        f"Efetuando fallback para a chave global do sistema."
                    )
                else:
                    raise exc

        # 2. Fallback / Execução via chave mestre global do sistema
        if not global_key:
            logger.error("[LLMEngineRouter] OPENROUTER_API_KEY mestre do sistema não está configurada.")
            raise OpenRouterAPIError("Chave de API global do OpenRouter não configurada no sistema.", status_code=401)

        logger.info(f"[LLMEngineRouter] Executando chamada via chave mestre global do sistema para tenant '{tenant_id}'.")
        return await self.provider.generate_completion(
            request=prompt_data,
            api_key=global_key,
        )
