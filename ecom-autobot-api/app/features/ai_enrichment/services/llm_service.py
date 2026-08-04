import asyncio
import time
from typing import Optional, List
from dotenv import load_dotenv

from app.core.shared.logger import get_logger
from app.features.ai_enrichment.domain.exceptions import AllProvidersExhaustedError
from app.features.ai_enrichment.domain.interfaces import LLMProvider
from app.features.ai_enrichment.infrastructure.providers import (
    DeepSeekProvider,
    GroqProvider,
    OpenRouterLLMProvider,
)
from app.features.products.schemas import Product, ProductStatus

logger = get_logger("LLMService")
load_dotenv()


class LLMService:
    """
    Serviço da camada de aplicação responsável por orquestrar o enriquecimento
    de produtos utilizando múltiplos provedores LLM com estratégia de Fallback e Resiliência.
    """

    def __init__(
        self,
        deepseek_api_key: Optional[str] = None,
        groq_api_key: Optional[str] = None,
        openrouter_api_key: Optional[str] = None,
        openrouter_preferred_models: Optional[List[str]] = None,
        is_demo: bool = False,
        providers: Optional[List[LLMProvider]] = None,
        **kwargs,
    ):
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
    async def create_for_tenant(cls, tenant_id: str, is_demo: bool = False) -> "LLMService":
        """
        Factory method que busca as chaves criptografadas (BYOK) do tenant no PostgreSQL,
        descriptografa em memória e instância o LLMService com os provedores ativos.
        """
        if is_demo or tenant_id == "demo_tenant":
            return cls(is_demo=True)

        from app.core.security.crypto import get_tenant_key, get_tenant_preferred_models

        deepseek_key = await get_tenant_key(tenant_id, "deepseek")
        groq_key = await get_tenant_key(tenant_id, "groq")
        openrouter_key = await get_tenant_key(tenant_id, "openrouter")
        openrouter_models = await get_tenant_preferred_models(tenant_id, "openrouter")

        return cls(
            deepseek_api_key=deepseek_key,
            groq_api_key=groq_key,
            openrouter_api_key=openrouter_key,
            openrouter_preferred_models=openrouter_models,
            is_demo=False,
        )

    async def enrich_product(self, product: Product) -> Product:
        prompt = f"""
        Você é um especialista em e-commerce e SEO. 
        Com base no produto abaixo, gere:
        1. Um título otimizado e focado em conversão de vendas.
        2. Uma descrição magnética e persuasiva (copywriting agressivo) em português do Brasil.
        3. Uma lista de tags estratégicas para SEO.

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
