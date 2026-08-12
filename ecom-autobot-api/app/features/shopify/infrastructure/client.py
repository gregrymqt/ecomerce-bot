import logging
from typing import List, Optional
import httpx
from tenacity import retry, retry_if_exception, stop_after_attempt, wait_exponential

from app.features.shopify.schemas import (
    ShopifyCreateMediaInput,
    ShopifyCreateMediaRequest,
    ShopifyCreateMediaVariables,
    ShopifyGraphQLRequest,
    ShopifyGraphQLVariables,
    ShopifyMediaInput,
    ShopifyProductDeleteInput,
    ShopifyProductDeleteRequest,
    ShopifyProductDeleteVariables,
    ShopifyProductListRequest,
    ShopifyProductSetInput,
    ShopifyProductUpdateInput,
    ShopifyProductUpdateRequest,
    ShopifyProductUpdateVariables,
    ShopifySEOInput,
)

from app.core.config.settings import settings

logger = logging.getLogger(__name__)


class ShopifyRateLimitError(Exception):
    """Exceção customizada para rate limits da API Shopify (HTTP 429 ou GraphQL Cost Throttling em 200 OK)."""
    pass


def is_rate_limit_error(exception: Exception) -> bool:
    if isinstance(exception, ShopifyRateLimitError):
        return True
    return isinstance(exception, httpx.HTTPStatusError) and exception.response.status_code == 429


class ShopifyClient:
    """
    Cliente de infraestrutura HTTP/GraphQL desacoplado para a Admin API do Shopify.
    Encapsula unicamente as chamadas externas de transporte e tratamento de userErrors.
    """

    def __init__(self, shop_domain: str, access_token: str, api_version: str | None = None):
        self.shop_domain = shop_domain
        self.access_token = access_token
        self.api_version = api_version or settings.SHOPIFY_API_VERSION
        clean_domain = shop_domain.replace("https://", "").replace("http://", "").split("/")[0]
        self.base_url = f"https://{clean_domain}/admin/api/{self.api_version}/graphql.json"

        self.headers = {
            "X-Shopify-Access-Token": self.access_token,
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

    def _check_graphql_errors(self, response_json: dict) -> None:
        """
        Verifica o payload JSON por erros do GraphQL. Se for detectado Cost Throttling (200 OK),
        dispara a exceção ShopifyRateLimitError para acionar o retry com backoff do tenacity.
        """
        if "errors" in response_json:
            errors = response_json["errors"]
            errors_str = str(errors).lower()
            if any(keyword in errors_str for keyword in ["throttled", "max_cost_exceeded", "call_limit_exceeded", "rate limit"]):
                logger.warning(f"GraphQL Cost Throttling detectado na API do Shopify: {errors}")
                raise ShopifyRateLimitError(f"Shopify GraphQL Rate Limit Exceeded: {errors}")
            
            logger.error(f"Erro de sintaxe/ambiente na API do Shopify: {errors}")
            raise ValueError(f"GraphQL Syntax Error: {errors}")

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception(is_rate_limit_error),
        reraise=True,
    )
    async def sync_product(self, internal_product_data: dict) -> dict:
        input_data = ShopifyProductSetInput.from_internal_data(internal_product_data)
        graphql_req = ShopifyGraphQLRequest(
            variables=ShopifyGraphQLVariables(input=input_data)
        )
        payload = graphql_req.model_dump(exclude_none=True)

        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(self.base_url, headers=self.headers, json=payload)
                response.raise_for_status()
                response_json = response.json()

                self._check_graphql_errors(response_json)

                product_set_result = response_json.get("data", {}).get("productSet", {})
                user_errors = product_set_result.get("userErrors", [])

                if user_errors:
                    for error in user_errors:
                        logger.error(
                            f"Erro de validação no Shopify - Campo: {error.get('field')} | Mensagem: {error.get('message')}"
                        )
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

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception(is_rate_limit_error),
        reraise=True,
    )
    async def create_product_media(self, product_id: str, image_urls: list[str], alt_text: str = None) -> dict:
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

                self._check_graphql_errors(response_json)

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

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception(is_rate_limit_error),
        reraise=True,
    )
    async def update_product(self, product_id: str, update_fields: dict, new_images: List[dict] = None) -> dict:
        seo_input = None
        if "seo_title" in update_fields or "seo_description" in update_fields:
            seo_input = ShopifySEOInput(
                title=update_fields.get("seo_title"),
                description=update_fields.get("seo_description"),
            )

        product_input = ShopifyProductUpdateInput(
            id=product_id,
            title=update_fields.get("title"),
            handle=update_fields.get("handle"),
            vendor=update_fields.get("vendor"),
            productType=update_fields.get("product_type"),
            status=update_fields.get("status"),
            tags=update_fields.get("tags"),
            seo=seo_input,
        )

        media_input = None
        if new_images:
            media_input = [
                ShopifyCreateMediaInput(
                    originalSource=img["url"],
                    alt=img.get("alt"),
                ) for img in new_images
            ]

        graphql_req = ShopifyProductUpdateRequest(
            variables=ShopifyProductUpdateVariables(product=product_input, media=media_input)
        )
        payload = graphql_req.model_dump(exclude_none=True)

        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(self.base_url, headers=self.headers, json=payload)
                response.raise_for_status()
                response_json = response.json()

                self._check_graphql_errors(response_json)

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

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception(is_rate_limit_error),
        reraise=True,
    )
    async def delete_product(self, product_id: str) -> Optional[str]:
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

                self._check_graphql_errors(response_json)

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

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception(is_rate_limit_error),
        reraise=True,
    )
    async def list_products(self, first: int = 10, after: Optional[str] = None) -> dict:
        graphql_req = ShopifyProductListRequest(
            variables={
                "first": first,
                "after": after,
            }
        )
        payload = graphql_req.model_dump()

        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(self.base_url, headers=self.headers, json=payload)
                response.raise_for_status()
                response_json = response.json()

                self._check_graphql_errors(response_json)

                products_connection = response_json.get("data", {}).get("products", {})
                return products_connection
            except httpx.HTTPStatusError as e:
                if e.response.status_code == 429:
                    logger.warning("Limite do algoritmo Leaky Bucket atingido no Shopify (429) ao listar. Acionando backoff...")
                raise e

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception(is_rate_limit_error),
        reraise=True,
    )
    async def set_inventory_quantity(self, inventory_item_id: str, location_id: str, quantity: int) -> dict:
        """
        Executa a mutação inventorySetQuantities para atualização rápida de estoque sem carregar o produto inteiro.
        """
        query = """
        mutation inventorySetQuantities($input: InventorySetQuantitiesInput!) {
          inventorySetQuantities(input: $input) {
            inventoryAdjustmentGroup {
              reason
            }
            userErrors {
              field
              message
            }
          }
        }
        """
        payload = {
            "query": query,
            "variables": {
                "input": {
                    "name": "available",
                    "reason": "correction",
                    "quantities": [
                        {
                            "inventoryItemId": inventory_item_id,
                            "locationId": location_id,
                            "quantity": quantity
                        }
                    ]
                }
            }
        }

        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(self.base_url, headers=self.headers, json=payload)
                response.raise_for_status()
                response_json = response.json()

                self._check_graphql_errors(response_json)

                result = response_json.get("data", {}).get("inventorySetQuantities", {})
                user_errors = result.get("userErrors", [])
                if user_errors:
                    logger.error(f"Erro de negócio no ajuste de estoque no Shopify: {user_errors}")
                    raise ValueError(f"Shopify Inventory Update Failed: {user_errors[0].get('message')}")

                logger.info(f"Estoque atualizado com sucesso no Shopify. Item: {inventory_item_id} -> {quantity}")
                return result
            except httpx.HTTPStatusError as e:
                if e.response.status_code == 429:
                    logger.warning("Rate limit no ajuste de estoque (429). Acionando backoff...")
                raise e

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception(is_rate_limit_error),
        reraise=True,
    )
    async def update_product_status(self, product_id: str, status: str) -> dict:
        """
        Executa a mutação productUpdate para alterar apenas o status (ACTIVE, DRAFT, ARCHIVED).
        """
        query = """
        mutation updateProductStatus($input: ProductInput!) {
          productUpdate(input: $input) {
            product {
              id
              status
            }
            userErrors {
              field
              message
            }
          }
        }
        """
        payload = {
            "query": query,
            "variables": {
                "input": {
                    "id": product_id,
                    "status": status.upper()
                }
            }
        }

        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(self.base_url, headers=self.headers, json=payload)
                response.raise_for_status()
                response_json = response.json()

                self._check_graphql_errors(response_json)

                result = response_json.get("data", {}).get("productUpdate", {})
                user_errors = result.get("userErrors", [])
                if user_errors:
                    logger.error(f"Erro de negócio na alteração de status no Shopify: {user_errors}")
                    raise ValueError(f"Shopify Status Update Failed: {user_errors[0].get('message')}")

                logger.info(f"Status do produto {product_id} alterado com sucesso para '{status}'.")
                return result
            except httpx.HTTPStatusError as e:
                if e.response.status_code == 429:
                    logger.warning("Rate limit na alteração de status (429). Acionando backoff...")
                raise e

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception(is_rate_limit_error),
        reraise=True,
    )
    async def get_primary_location_id(self) -> Optional[str]:
        """
        Busca o GID da localização primária cadastrada na loja do Shopify.
        """
        query = """
        query getLocations {
          locations(first: 1) {
            nodes {
              id
            }
          }
        }
        """
        payload = {"query": query, "variables": {}}

        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(self.base_url, headers=self.headers, json=payload)
                response.raise_for_status()
                response_json = response.json()

                self._check_graphql_errors(response_json)

                nodes = response_json.get("data", {}).get("locations", {}).get("nodes", [])
                if nodes:
                    return nodes[0].get("id")
                return None
            except Exception as err:
                logger.warning(f"Não foi possível obter location_id primário: {err}")
                return None

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception(is_rate_limit_error),
        reraise=True,
    )
    async def create_staged_upload(self, input_data: List[dict]) -> dict:
        """
        Executa a mutação stagedUploadsCreate para obter URLs pré-assinadas da CDN do Shopify.
        """
        query = """
        mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
          stagedUploadsCreate(input: $input) {
            stagedTargets {
              url
              resourceUrl
              parameters {
                name
                value
              }
            }
            userErrors {
              field
              message
            }
          }
        }
        """
        payload = {"query": query, "variables": {"input": input_data}}

        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(self.base_url, headers=self.headers, json=payload)
                response.raise_for_status()
                response_json = response.json()

                self._check_graphql_errors(response_json)

                result = response_json.get("data", {}).get("stagedUploadsCreate", {})
                user_errors = result.get("userErrors", [])
                if user_errors:
                    logger.error(f"Erro de negócio no stagedUploadsCreate do Shopify: {user_errors}")
                    raise ValueError(f"Shopify Staged Upload Failed: {user_errors[0].get('message')}")

                logger.info("URL pré-assinada (Staged Upload) gerada com sucesso na CDN do Shopify.")
                return result
            except httpx.HTTPStatusError as e:
                if e.response.status_code == 429:
                    logger.warning("Rate limit no stagedUploadsCreate (429). Acionando backoff...")
                raise e

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception(is_rate_limit_error),
        reraise=True,
    )
    async def run_bulk_mutation(self, staged_upload_path: str, mutation_query: str) -> dict:
        """
        Executa a mutação bulkOperationRunMutation para processamento assíncrono em massa no Shopify.
        """
        query = """
        mutation bulkOperationRunMutation($mutation: String!, $stagedUploadPath: String!) {
          bulkOperationRunMutation(mutation: $mutation, stagedUploadPath: $stagedUploadPath) {
            bulkOperation {
              id
              status
              url
            }
            userErrors {
              field
              message
            }
          }
        }
        """
        payload = {
            "query": query,
            "variables": {
                "mutation": mutation_query,
                "stagedUploadPath": staged_upload_path,
            },
        }

        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(self.base_url, headers=self.headers, json=payload)
                response.raise_for_status()
                response_json = response.json()

                self._check_graphql_errors(response_json)

                result = response_json.get("data", {}).get("bulkOperationRunMutation", {})
                user_errors = result.get("userErrors", [])
                if user_errors:
                    logger.error(f"Erro de negócio na execução de Bulk Mutation no Shopify: {user_errors}")
                    raise ValueError(f"Shopify Bulk Mutation Failed: {user_errors[0].get('message')}")

                bulk_op = result.get("bulkOperation", {})
                logger.info(f"Operação em lote (Bulk Operation) iniciada com sucesso. GID: {bulk_op.get('id')} | Status: {bulk_op.get('status')}")
                return result
            except httpx.HTTPStatusError as e:
                if e.response.status_code == 429:
                    logger.warning("Rate limit na execução de Bulk Mutation (429). Acionando backoff...")
                raise e

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception(is_rate_limit_error),
        reraise=True,
    )
    async def get_current_bulk_operation(self) -> dict:
        """
        Consulta o estado atual da Bulk Operation assíncrona.
        """
        query = """
        query {
          currentBulkOperation(type: MUTATION) {
            id
            status
            errorCode
            createdAt
            completedAt
            objectCount
            fileSize
            url
          }
        }
        """
        payload = {"query": query, "variables": {}}

        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(self.base_url, headers=self.headers, json=payload)
                response.raise_for_status()
                response_json = response.json()

                self._check_graphql_errors(response_json)

                result = response_json.get("data", {}).get("currentBulkOperation", {})
                return result or {}
            except httpx.HTTPStatusError as e:
                if e.response.status_code == 429:
                    logger.warning("Rate limit na consulta de Bulk Operation (429). Acionando backoff...")
                raise e


