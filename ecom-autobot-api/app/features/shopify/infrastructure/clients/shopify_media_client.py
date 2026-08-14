import logging
import httpx
from tenacity import retry, retry_if_exception, stop_after_attempt, wait_exponential

from app.features.shopify.infrastructure.clients.shopify_base_client import (
    ShopifyBaseClient,
    is_rate_limit_error,
)
from app.features.shopify.schemas import (
    ShopifyCreateMediaRequest,
    ShopifyCreateMediaVariables,
    ShopifyMediaInput,
)

logger = logging.getLogger(__name__)


class ShopifyMediaClient(ShopifyBaseClient):
    """
    Cliente especializado para mutações de Mídias e Imagens no Shopify.
    """

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
