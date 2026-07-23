import abc
import asyncio
import logging
import openai
from app.features.ai_enrichment.schemas import EnrichedProductResponse
from app.core.shared.logger import get_logger
from app.core.config.settings import settings

logger = get_logger("LLMProvider")

class LLMProvider(abc.ABC):
    @abc.abstractmethod
    async def enrich(self, prompt: str) -> EnrichedProductResponse:
        pass
    
    @property
    @abc.abstractmethod
    def name(self) -> str:
        pass


class DeepSeekProvider(LLMProvider):
    def __init__(self, api_key: str = None):
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


class GroqProvider(LLMProvider):
    def __init__(self, api_key: str = None):
        key = api_key or settings.GROQ_API_KEY
        if not key:
            raise ValueError("GROQ_API_KEY is not configured.")
        self.client = openai.AsyncOpenAI(api_key=key, base_url="https://api.groq.com/openai/v1")

    @property
    def name(self) -> str:
        return "Groq"

    async def enrich(self, prompt: str) -> EnrichedProductResponse:
        response = await self.client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
        )
        content = response.choices[0].message.content
        try:
            return EnrichedProductResponse.model_validate_json(content)
        except Exception as e:
            logger.error(f"Erro ao validar schema do Groq: {e} | Resposta: {content}", exc_info=True)
            raise
