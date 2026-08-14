import logging
from typing import List, Optional
import httpx
from tenacity import retry, retry_if_exception, stop_after_attempt, wait_exponential

from app.features.shopify.infrastructure.clients.shopify_base_client import (
    ShopifyBaseClient,
    is_rate_limit_error,
)
from app.features.shopify.schemas import (
    ShopifyCreateMediaInput,
    ShopifyGraphQLRequest,
    ShopifyGraphQLVariables,
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

logger = logging.getLogger(__name__)


class ShopifyProductClient(ShopifyBaseClient):
    """
    Cliente especializado para operações GraphQL de Produtos do Shopify (sync, update, delete, list, status).
    """

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
    async def update_product_status(self, product_id: str, status: str) -> dict:
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
