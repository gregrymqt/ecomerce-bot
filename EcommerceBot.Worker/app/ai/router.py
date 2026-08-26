import logging
from typing import Optional
from app.ai.providers.openrouter_provider import OpenRouterLLMProvider
from app.ai.schemas import LLMCompletionRequest, LLMCompletionResponse

logger = logging.getLogger(__name__)

class LLMEngineRouter:
    """
    Roteador de LLM assíncrono para enriquecimento de produtos e geração de copywriting SEO.
    """

    def __init__(self, provider: Optional[OpenRouterLLMProvider] = None):
        self.provider = provider or OpenRouterLLMProvider()

    async def generate_completion(
        self,
        prompt_data: LLMCompletionRequest,
        api_key: Optional[str] = None,
    ) -> LLMCompletionResponse:
        return await self.provider.generate_completion(request=prompt_data, api_key=api_key)
