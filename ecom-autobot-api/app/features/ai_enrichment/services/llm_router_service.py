from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config.settings import settings
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

logger = get_logger("LLMEngineRouter")


class LLMEngineRouter:
    """
    Serviço de roteamento de IA responsável por orquestrar requisições assíncronas ao OpenRouter
    utilizando a chave mestre unificada `OPENROUTER_API_KEY` com lista de modelos em fallback encadeado.
    """

    def __init__(self, provider: Optional[OpenRouterLLMProvider] = None):
        self.provider = provider or OpenRouterLLMProvider()

    async def generate_completion(
        self,
        tenant_id: str,
        prompt_data: LLMCompletionRequest,
        db: Optional[AsyncSession] = None,
    ) -> LLMCompletionResponse:
        """
        Gera uma conclusão via OpenRouter utilizando diretamente a chave mestre unificada `OPENROUTER_API_KEY`.
        """
        global_key = (settings.OPENROUTER_API_KEY or "").strip()

        if not global_key:
            logger.error("[LLMEngineRouter] OPENROUTER_API_KEY mestre do sistema não está configurada.")
            raise OpenRouterAPIError("Chave de API global do OpenRouter não configurada no sistema.", status_code=401)

        logger.info(f"[LLMEngineRouter] Executando chamada via chave mestre global do sistema para tenant '{tenant_id}'.")
        return await self.provider.generate_completion(
            request=prompt_data,
            api_key=global_key,
        )
