from app.models.shopify_models import ShopifyProductListRequest
from app.models.shopify_models import ShopifyProductDeleteInput
from app.models.shopify_models import ShopifyProductDeleteVariables
from app.models.shopify_models import ShopifyProductDeleteRequest
from typing import List
from app.models.shopify_models import ShopifySEOInput
from app.models.shopify_models import ShopifyProductUpdateInput
from app.models.shopify_models import ShopifyProductUpdateVariables
from app.models.shopify_models import ShopifyProductUpdateRequest
from app.models.shopify_models import ShopifyCreateMediaInput
from app.models.shopify_models import ShopifyCreateMediaVariables
from app.models.shopify_models import ShopifyCreateMediaRequest
from app.models.shopify_models import ShopifyMediaInput
import httpx
import logging
from typing import Dict, Any, Optional
from app.models.shopify_models import ShopifyProductSetInput, ShopifyGraphQLVariables, ShopifyGraphQLRequest
from tenacity import retry, wait_exponential, stop_after_attempt, retry_if_exception

logger = logging.getLogger(__name__)

def is_rate_limit_error(exception: Exception) -> bool:
    return isinstance(exception, httpx.HTTPStatusError) and exception.response.status_code == 429

class ShopifyService:
    """
    Serviço responsável pela integração com a Admin GraphQL API do Shopify.
    Abstrai mutações idempotentes usando o endpoint estável (2024-04+).
    """
    def __init__(self, shop_domain: str, access_token: str, api_version: str = "2024-04"):
        self.shop_domain = shop_domain
        self.access_token = access_token
        # Removendo possíveis barras ou esquemas para garantir a higienização do domínio
        clean_domain = shop_domain.replace("https://", "").replace("http://", "").split("/")[0]
        self.base_url = f"https://{clean_domain}/admin/api/{api_version}/graphql.json"
        
        # Headers mandatórios para autenticação administrativa de Apps customizados/SaaS
        self.headers = {
            "X-Shopify-Access-Token": self.access_token,
            "Content-Type": "application/json",
            "Accept": "application/json"
        }

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception(is_rate_limit_error),
        reraise=True
    )
    async def sync_product(self, internal_product_data: dict) -> Dict[str, Any]:
        """
        Executa a mutação idempotente productSet utilizando o payload interno do bot.
        Mapeia os dados via Pydantic e trata explicitamente falhas de negócio (userErrors).
        """
        # 1. Converte e valida os dados internos do bot usando o método da sua model
        input_data = ShopifyProductSetInput.from_internal_data(internal_product_data)
        
        # 2. Constrói a requisição envelopada com a Query e Variables
        graphql_req = ShopifyGraphQLRequest(
            variables=ShopifyGraphQLVariables(input=input_data)
        )
        
        # O Shopify espera o payload como um dicionário plano contendo "query" e "variables"
        payload = graphql_req.model_dump(exclude_none=True)

        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(self.base_url, headers=self.headers, json=payload)
                
                # Trata erros severos de infraestrutura/autenticação (ex: 401 Unauthorized, 429 Too Many Requests)
                response.raise_for_status()
                
                response_json = response.json()
                
                # O Shopify pode retornar uma chave 'errors' na raiz se a sintaxe do GraphQL estiver quebrada
                if "errors" in response_json:
                    logger.error(f"Erro de sintaxe/ambiente na API do Shopify: {response_json['errors']}")
                    raise ValueError(f"GraphQL Syntax Error: {response_json['errors']}")

                # 3. Tratamento Avançado de Erros de Negócio (userErrors)
                product_set_result = response_json.get("data", {}).get("productSet", {})
                user_errors = product_set_result.get("userErrors", [])

                if user_errors:
                    for error in user_errors:
                        logger.error(
                            f"Erro de validação no Shopify - Campo: {error.get('field')} | Mensagem: {error.get('message')}"
                        )
                    # Lança exceção de negócio para impedir que a esteira de mensageria marque a tarefa como concluída
                    raise ValueError(f"Shopify Business Validation Failed: {user_errors[0].get('message')}")

                product_data = product_set_result.get("product", {})
                logger.info(f"Produto sincronizado com sucesso no Shopify GraphQL. GID: {product_data.get('id')}")
                return product_set_result

            except httpx.HTTPStatusError as e:
                if e.response.status_code == 429:
                    logger.warning("Limite do algoritmo Leaky Bucket atingido no Shopify (429). Acionando backoff...")
                else:
                    logger.error(f"Erro de transporte HTTP com a API do Shopify [Status {e.response.status_code}]: {e.response.text}")
                raise e
            except Exception as e:
                logger.error(f"Falha inesperada na sincronização com o Shopify: {str(e)}")
                raise e
                
    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception(is_rate_limit_error),
        reraise=True
    )
    async def create_product_media(self, product_id: str, image_urls: list[str], alt_text: str = None) -> dict:
        """
        Anexa novas imagens geradas por IA a um produto existente no Shopify via GraphQL.
        """
        media_inputs = [
            ShopifyMediaInput(originalSource=url, alt=alt_text)
            for url in image_urls
        ]
        
        graphql_req = ShopifyCreateMediaRequest(
            variables=ShopifyCreateMediaVariables(productId=product_id, media=media_inputs)
        )
        
        payload = graphql_req.model_dump(exclude_none=True)

        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(self.base_url, headers=self.headers, json=payload)
                response.raise_for_status()
                response_json = response.json()
                
                if "errors" in response_json:
                    raise ValueError(f"GraphQL Syntax Error: {response_json['errors']}")

                result = response_json.get("data", {}).get("productCreateMedia", {})
                user_errors = result.get("userErrors", [])

                if user_errors:
                    logger.error(f"Erro de negócio ao criar mídia no Shopify: {user_errors}")
                    raise ValueError(f"Shopify Media Creation Failed: {user_errors[0].get('message')}")

                logger.info(f"Mídias anexadas com sucesso ao produto {product_id}.")
                return result
            except httpx.HTTPStatusError as e:
                if e.response.status_code == 429:
                    logger.warning("Limite do algoritmo Leaky Bucket atingido no Shopify (429) ao criar mídia. Acionando backoff...")
                raise e
            except Exception as e:
                logger.error(f"Falha ao executar productCreateMedia: {str(e)}")
                raise e            

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception(is_rate_limit_error),
        reraise=True
    )
    async def update_product(self, product_id: str, update_fields: dict, new_images: List[dict] = None) -> dict:
        """
        Atualiza os dados de copywriting de um produto e anexa opcionalmente
        novas mídias geradas via IA em uma única chamada atômica GraphQL.
        """
        # Preparando o input de propriedades textuais/SEO
        seo_input = None
        if "seo_title" in update_fields or "seo_description" in update_fields:
            seo_input = ShopifySEOInput(
                title=update_fields.get("seo_title"),
                description=update_fields.get("seo_description")
            )

        product_input = ShopifyProductUpdateInput(
            id=product_id,
            title=update_fields.get("title"),
            handle=update_fields.get("handle"),
            vendor=update_fields.get("vendor"),
            productType=update_fields.get("product_type"),
            status=update_fields.get("status"),
            tags=update_fields.get("tags"),
            seo=seo_input
        )

        # Mapeando o array de mídias assíncronas se fornecido
        media_input = None
        if new_images:
            media_input = [
                ShopifyCreateMediaInput(
                    originalSource=img["url"],
                    alt=img.get("alt")
                ) for img in new_images
            ]

        # Montando a requisição tipada
        graphql_req = ShopifyProductUpdateRequest(
            variables=ShopifyProductUpdateVariables(product=product_input, media=media_input)
        )
        
        payload = graphql_req.model_dump(exclude_none=True)

        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(self.base_url, headers=self.headers, json=payload)
                response.raise_for_status()
                response_json = response.json()
                
                if "errors" in response_json:
                    raise ValueError(f"GraphQL Syntax Error: {response_json['errors']}")

                result = response_json.get("data", {}).get("productUpdate", {})
                user_errors = result.get("userErrors", [])

                if user_errors:
                    logger.error(f"Erro de validação de negócio no update do Shopify: {user_errors}")
                    raise ValueError(f"Shopify Product Update Failed: {user_errors[0].get('message')}")

                logger.info(f"Produto {product_id} e suas mídias atualizados com sucesso no Shopify.")
                return result
            except httpx.HTTPStatusError as e:
                if e.response.status_code == 429:
                    logger.warning("Limite do algoritmo Leaky Bucket atingido no Shopify (429) no update. Acionando backoff...")
                raise e
            except Exception as e:
                logger.error(f"Falha ao executar productUpdate: {str(e)}")
                raise e            

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception(is_rate_limit_error),
        reraise=True
    )
    async def delete_product(self, product_id: str) -> Optional[str]:
        """
        Deleta permanentemente um produto do catálogo do Shopify via GraphQL Admin API.
        Retorna o ID do produto deletado ou levanta exceção caso ocorra userErrors.
        """
        graphql_req = ShopifyProductDeleteRequest(
            variables=ShopifyProductDeleteVariables(
                input=ShopifyProductDeleteInput(id=product_id)
            )
        )
        
        payload = graphql_req.model_dump()

        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(self.base_url, headers=self.headers, json=payload)
                response.raise_for_status()
                response_json = response.json()
                
                if "errors" in response_json:
                    raise ValueError(f"GraphQL Syntax Error: {response_json['errors']}")

                result = response_json.get("data", {}).get("productDelete", {})
                user_errors = result.get("userErrors", [])

                if user_errors:
                    logger.error(f"Erro de negócio na remoção do produto no Shopify: {user_errors}")
                    raise ValueError(f"Shopify Product Deletion Failed: {user_errors[0].get('message')}")

                deleted_id = result.get("deletedProductId")
                logger.info(f"Produto {deleted_id} removido com sucesso do catálogo Shopify.")
                return deleted_id
            except httpx.HTTPStatusError as e:
                if e.response.status_code == 429:
                    logger.warning("Limite do algoritmo Leaky Bucket atingido no Shopify (429) no delete. Acionando backoff...")
                raise e
            except Exception as e:
                logger.error(f"Falha ao executar productDelete: {str(e)}")
                raise e            

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception(is_rate_limit_error),
        reraise=True
    )
    async def list_products(self, first: int = 10, after: Optional[str] = None) -> dict:
        """
        Retorna uma lista paginada por cursor contendo os produtos do Tenant.
        Garante a passagem segura do token administrativo e expõe o endCursor.
        """
        graphql_req = ShopifyProductListRequest(
            variables={
                "first": first,
                "after": after
            }
        )
        
        payload = graphql_req.model_dump()

        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(self.base_url, headers=self.headers, json=payload)
                response.raise_for_status()
                response_json = response.json()
                
                if "errors" in response_json:
                    raise ValueError(f"GraphQL Syntax Error: {response_json['errors']}")

                # Extrai o nó central de produtos conforme o contrato da documentação
                products_connection = response_json.get("data", {}).get("products", {})
                return products_connection
            except httpx.HTTPStatusError as e:
                if e.response.status_code == 429:
                    logger.warning("Limite do algoritmo Leaky Bucket atingido no Shopify (429) ao listar. Acionando backoff...")
                raise e
            except Exception as e:
                logger.error(f"Falha ao listar produtos via Shopify GraphQL: {str(e)}")
                raise e            