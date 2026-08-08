import json
import asyncio
import time
from typing import Optional, List, Tuple, Dict, Any
from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.shared.logger import get_logger
from app.features.ai_enrichment.domain.exceptions import (
    AllProvidersExhaustedError,
    LLMProviderError,
    OpenRouterAPIError,
)
from app.features.ai_enrichment.schemas import (
    EnrichedProductResponse,
    LLMCompletionRequest,
    LLMCompletionResponse,
)
from app.features.ai_enrichment.services.llm_router_service import LLMEngineRouter
from app.features.products.schemas import Product, ProductStatus
from app.features.settings.schemas.settings_schemas import (
    TenantSettingsResponse,
    AiSettingsSchema,
    StoreProfileSchema,
)

logger = get_logger("LLMService")
load_dotenv()


class LLMService:
    """
    Serviço de aplicação responsável por orquestrar o enriquecimento de copy de produtos
    utilizando o LLMEngineRouter (OpenRouter com suporte a BYOK do Tenant e Fallback Global).
    """

    def __init__(
        self,
        llm_router: Optional[LLMEngineRouter] = None,
        tenant_settings: Optional[TenantSettingsResponse] = None,
        providers: Optional[List[Any]] = None,
        **kwargs,
    ):
        self.llm_router = llm_router or LLMEngineRouter()
        self.tenant_settings = tenant_settings or TenantSettingsResponse(tenant_id="default")
        self.providers = providers or [self.llm_router.provider]

    @classmethod
    async def create_for_tenant(
        cls,
        tenant_id: str,
        is_demo: bool = False,
        session: Optional[AsyncSession] = None,
    ) -> "LLMService":
        """
        Factory method assíncrono que busca as preferências personalizadas da marca no PostgreSQL/Redis (Settings)
        e instancia o LLMService com o LLMEngineRouter pronto para uso.
        """
        from app.features.settings.services.settings_service import SettingsService
        from app.features.settings.repositories.settings_repository import SettingsRepository

        tenant_settings = None
        if not is_demo and tenant_id != "demo_tenant":
            try:
                settings_repo = SettingsRepository(session=session)
                settings_service = SettingsService(repository=settings_repo)
                tenant_settings = await settings_service.get_settings(tenant_id=tenant_id)
            except Exception as e:
                logger.warning(f"Erro ao carregar preferências para tenant '{tenant_id}': {e}. Usando padrões.")

        if tenant_settings is None:
            tenant_settings = TenantSettingsResponse(tenant_id=tenant_id)

        router = LLMEngineRouter()
        return cls(
            llm_router=router,
            tenant_settings=tenant_settings,
        )

    def _parse_completion_json(self, content_raw: str, default_title: str, default_description: str) -> Tuple[str, str, List[str]]:
        """Limpa blocos de código Markdown (```json) e extrai title, description e tags do JSON."""
        clean = content_raw.strip()
        if clean.startswith("```json"):
            clean = clean[7:]
        if clean.startswith("```"):
            clean = clean[3:]
        if clean.endswith("```"):
            clean = clean[:-3]
        clean = clean.strip()

        try:
            parsed = json.loads(clean)
            title = parsed.get("title") or default_title
            description = parsed.get("description") or default_description
            tags = parsed.get("tags") or []
            if isinstance(tags, str):
                tags = [t.strip() for t in tags.split(",") if t.strip()]
            return title, description, tags
        except Exception:
            logger.warning(f"Não foi possível converter a resposta da LLM em JSON puro. Conteúdo recebido: {clean[:100]}")
            return default_title, clean or default_description, []

    async def enrich_product(
        self,
        product: Product,
        tenant_id: Optional[str] = None,
        session: Optional[AsyncSession] = None,
    ) -> Product:
        """
        Enriquece os campos de título, descrição e tags SEO do produto chamando o LLMEngineRouter.
        """
        effective_tenant_id = tenant_id or product.tenant_id or "default"
        ai_sets = getattr(self.tenant_settings, "ai_settings", AiSettingsSchema())
        store_prof = getattr(self.tenant_settings, "store_profile", StoreProfileSchema())

        tone_of_voice = ai_sets.tone_of_voice or "persuasivo"
        target_language = ai_sets.target_language or "pt-BR"
        seo_enabled = ai_sets.seo_tags_enabled
        custom_instructions = (ai_sets.custom_instructions or "").strip()

        seo_clause = (
            "3. Uma lista de tags estratégicas para SEO."
            if seo_enabled
            else "3. Omita a geração de tags de SEO (retorne lista vazia)."
        )

        store_details = ""
        if store_prof and (store_prof.store_name or store_prof.niche):
            parts = []
            if store_prof.store_name:
                parts.append(f"Nome da Loja: '{store_prof.store_name}'")
            if store_prof.niche:
                parts.append(f"Nicho: '{store_prof.niche}'")
            store_details = f"\n- Contexto do Lojista: {', '.join(parts)}."

        custom_clause = ""
        if custom_instructions:
            custom_safe = custom_instructions[:1000]
            custom_clause = f"\n- Diretrizes Específicas do Lojista: {custom_safe}"

        prompt = f"""
Você é um especialista em e-commerce, copywriting de vendas e SEO.
Com base no produto abaixo, gere o enriquecimento e retorne obrigatoriamente um objeto JSON válido com os campos "title", "description" e "tags".

Exemplo de formato esperado:
{{
  "title": "Título otimizado para conversão de vendas",
  "description": "Descrição persuasiva e magnética com gatilhos mentais",
  "tags": ["tag1", "tag2", "tag3"]
}}

Diretrizes da Marca & Formatação:
- Idioma Alvo: Escreva todos os textos estritamente em {target_language}.
- Tom de Voz: Utilize um tom de voz {tone_of_voice}.{store_details}{custom_clause}

Produto Original: {product.title or ''}
Descrição Original: {product.description or ''}
"""

        system_prompt = "Você é um assistente de IA especialista em e-commerce, copywriting e otimização de conversão."

        prompt_req = LLMCompletionRequest(
            prompt=prompt,
            system_prompt=system_prompt,
            temperature=0.7,
            max_tokens=1000,
        )

        try:
            completion_res = await self.llm_router.generate_completion(
                tenant_id=effective_tenant_id,
                prompt_data=prompt_req,
                db=session,
            )
        except Exception as exc:
            logger.error(f"Erro no enriquecimento LLM para SKU '{product.sku}': {exc}")
            raise AllProvidersExhaustedError(f"Falha ao gerar conclusão no OpenRouter: {exc}") from exc

        # Extrai título, descrição e tags
        title, description, tags = self._parse_completion_json(
            completion_res.content,
            default_title=product.title or "",
            default_description=product.description or "",
        )

        product.title = title
        product.description = description

        if not hasattr(product, "attributes") or product.attributes is None:
            product.attributes = {}

        if seo_enabled and tags:
            product.attributes["seo_tags"] = ",".join(tags)

        # Dados de auditoria do enriquecimento
        enrichment_metadata = {
            "model_used": completion_res.model_used,
            "prompt_tokens": completion_res.prompt_tokens,
            "completion_tokens": completion_res.completion_tokens,
            "total_tokens": completion_res.total_tokens,
            "response_time_ms": completion_res.provider_response_time_ms,
        }
        product.attributes["enrichment_metadata"] = json.dumps(enrichment_metadata)
        setattr(product, "ai_enriched_data", enrichment_metadata)

        product.status = ProductStatus.PROCESSED
        return product

