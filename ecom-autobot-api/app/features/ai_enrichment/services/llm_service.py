import asyncio
import time
from typing import Optional, List
from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.shared.logger import get_logger
from app.features.ai_enrichment.domain.exceptions import AllProvidersExhaustedError
from app.features.ai_enrichment.domain.interfaces import LLMProvider
from app.features.ai_enrichment.infrastructure.providers import (
    DeepSeekProvider,
    GroqProvider,
    OpenRouterLLMProvider,
)
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
    Serviço da camada de aplicação responsável por orquestrar o enriquecimento
    de produtos utilizando múltiplos provedores LLM com estratégia de Fallback, Resiliência
    e injeção dinâmica de preferências do tenant (tom de voz, idioma, SEO e diretrizes customizadas).
    """

    def __init__(
        self,
        deepseek_api_key: Optional[str] = None,
        groq_api_key: Optional[str] = None,
        openrouter_api_key: Optional[str] = None,
        openrouter_preferred_models: Optional[List[str]] = None,
        is_demo: bool = False,
        providers: Optional[List[LLMProvider]] = None,
        tenant_settings: Optional[TenantSettingsResponse] = None,
        **kwargs,
    ):
        self.tenant_settings = tenant_settings or TenantSettingsResponse(tenant_id="default")

        if providers is not None:
            self.providers = providers
        else:
            self.providers = []
            try:
                self.providers.append(DeepSeekProvider(api_key=deepseek_api_key))
            except Exception as e:
                logger.warning(f"DeepSeekProvider não configurado: {e}")

            try:
                self.providers.append(GroqProvider(api_key=groq_api_key))
            except Exception as e:
                logger.warning(f"GroqProvider não configurado: {e}")

            try:
                self.providers.append(
                    OpenRouterLLMProvider(
                        api_key=openrouter_api_key,
                        preferred_models=openrouter_preferred_models,
                    )
                )
            except Exception as e:
                logger.warning(f"OpenRouterLLMProvider não configurado: {e}")

        if is_demo:
            self.providers.sort(key=lambda p: 0 if p.name == "Groq" else 1)

    @classmethod
    async def create_for_tenant(
        cls,
        tenant_id: str,
        is_demo: bool = False,
        session: Optional[AsyncSession] = None,
    ) -> "LLMService":
        """
        Factory method que busca as chaves criptografadas (BYOK) do tenant no PostgreSQL
        e as preferências personalizadas da marca (Settings) para instanciar o LLMService.
        """
        if is_demo or tenant_id == "demo_tenant":
            return cls(is_demo=True, tenant_id=tenant_id)

        from app.core.security.crypto import get_tenant_key, get_tenant_preferred_models
        from app.features.settings.services.settings_service import SettingsService
        from app.features.settings.repositories.settings_repository import SettingsRepository

        deepseek_key = await get_tenant_key(tenant_id, "deepseek")
        groq_key = await get_tenant_key(tenant_id, "groq")
        openrouter_key = await get_tenant_key(tenant_id, "openrouter")
        openrouter_models = await get_tenant_preferred_models(tenant_id, "openrouter")

        # Carrega as configurações operacionais do tenant (Tom de Voz, Idioma, SEO, Instruções)
        try:
            settings_repo = SettingsRepository(session=session)
            settings_service = SettingsService(repository=settings_repo)
            tenant_settings = await settings_service.get_settings(tenant_id=tenant_id)
        except Exception as e:
            logger.warning(f"Erro ao carregar preferências para tenant '{tenant_id}': {e}. Usando padrões.")
            tenant_settings = TenantSettingsResponse(tenant_id=tenant_id)

        return cls(
            deepseek_api_key=deepseek_key,
            groq_api_key=groq_key,
            openrouter_api_key=openrouter_key,
            openrouter_preferred_models=openrouter_models,
            is_demo=False,
            tenant_settings=tenant_settings,
        )

    async def enrich_product(self, product: Product) -> Product:
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
Com base no produto abaixo, gere:
1. Um título otimizado e focado em conversão de vendas.
2. Uma descrição magnética e persuasiva seguindo estritamente as diretrizes da marca.
{seo_clause}

Diretrizes da Marca & Formatação:
- Idioma Alvo: Escreva todos os textos estritamente em {target_language}.
- Tom de Voz: Utilize um tom de voz {tone_of_voice}.{store_details}{custom_clause}

Produto Original: {product.title}
Descrição Original: {product.description}

Retorne os dados respeitando o formato solicitado.
"""

        sku = product.sku
        start_time = time.time()

        for provider in self.providers:
            log_extra = {"sku": sku, "provider": provider.name}
            try:
                logger.info(f"Tentando {provider.name} para SKU: {sku}...", extra=log_extra)

                if provider != self.providers[0]:
                    await asyncio.sleep(5)

                enriched_response = await provider.enrich(prompt)

                product.title = enriched_response.title
                product.description = enriched_response.description

                if hasattr(product, "attributes"):
                    if product.attributes is None:
                        product.attributes = {}
                    if seo_enabled and enriched_response.tags:
                        product.attributes["seo_tags"] = ",".join(enriched_response.tags)

                product.status = ProductStatus.PROCESSED

                duration = round(time.time() - start_time, 2)
                logger.info(f"Sucesso com {provider.name} para SKU: {sku} em {duration}s.", extra=log_extra)
                return product

            except Exception as e:
                logger.warning(f"Falha {provider.name} ({type(e).__name__}). Tentando próximo provider...", extra=log_extra)
                continue

        logger.error(f"Todos os provedores de LLM falharam para SKU: {sku}.", extra={"sku": sku})
        raise AllProvidersExhaustedError("Nenhum provedor de LLM disponível conseguiu processar a requisição.")
