import asyncio
import time
from dotenv import load_dotenv
from app.providers.llm_provider import DeepSeekProvider, GroqProvider
from app.utils.logger import get_logger

logger = get_logger("LLMService")
load_dotenv()

from app.models.products import Product, ProductStatus

class AllProvidersExhaustedError(Exception):
    pass

class LLMService:
    def __init__(self, deepseek_api_key: str = None, groq_api_key: str = None, is_demo: bool = False, **kwargs):
        # Initialize the list of providers in the order we want to use them
        self.providers = []
        try:
            self.providers.append(DeepSeekProvider(api_key=deepseek_api_key))
        except Exception as e:
            logger.warning(f"DeepSeekProvider não configurado: {e}")
            
        try:
            self.providers.append(GroqProvider(api_key=groq_api_key))
        except Exception as e:
            logger.warning(f"GroqProvider não configurado: {e}")

        if is_demo:
            self.providers.sort(key=lambda p: 0 if p.name == "Groq" else 1)

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
                
                # Só aguarda se não for o primeiro provider da lista (tentativa de fallback)
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
                # Trata erros (incluindo 429 e Network Errors) e tenta o próximo provedor
                logger.warning(f"Falha {provider.name} ({type(e).__name__}). Tentando próximo provider...", extra=log_extra)
                continue
                
        # Se esgotar a lista de provedores
        logger.error(f"Todos os provedores de LLM falharam para SKU: {sku}.", extra={"sku": sku})
        raise AllProvidersExhaustedError("Nenhum provedor de LLM disponível conseguiu processar a requisição.")