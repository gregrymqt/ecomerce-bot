import abc
from app.features.ai_enrichment.schemas.enrichment_schemas import EnrichedProductResponse


class LLMProvider(abc.ABC):
    """Contrato abstrato de Domínio para Provedores de Inteligência Artificial / LLM."""

    @abc.abstractmethod
    async def enrich(self, prompt: str) -> EnrichedProductResponse:
        """Enriquece as informações de um produto com base no prompt fornecido."""
        pass

    @property
    @abc.abstractmethod
    def name(self) -> str:
        """Retorna o nome identificador do provedor (ex: DeepSeek, Groq)."""
        pass
