from typing import Optional
import openai

from app.core.config.settings import settings
from app.core.shared.logger import get_logger
from app.features.ai_enrichment.domain.interfaces import LLMProvider
from app.features.ai_enrichment.schemas import EnrichedProductResponse

logger = get_logger("DeepSeekProvider")


class DeepSeekProvider(LLMProvider):
    """Implementação concreta de infraestrutura para o provedor DeepSeek via AsyncOpenAI SDK."""

    def __init__(self, api_key: Optional[str] = None):
        key = api_key or settings.DEEPSEEK_API_KEY
        if not key:
            raise ValueError("DEEPSEEK_API_KEY is not configured.")
        self.client = openai.AsyncOpenAI(api_key=key, base_url="https://api.deepseek.com")

    @property
    def name(self) -> str:
        return "DeepSeek"

    async def enrich(self, prompt: str) -> EnrichedProductResponse:
        response = await self.client.chat.completions.create(
            model="deepseek-chat",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
        )
        content = response.choices[0].message.content
        try:
            return EnrichedProductResponse.model_validate_json(content)
        except Exception as e:
            logger.error(f"Erro ao validar schema do DeepSeek: {e} | Resposta: {content}", exc_info=True)
            raise
