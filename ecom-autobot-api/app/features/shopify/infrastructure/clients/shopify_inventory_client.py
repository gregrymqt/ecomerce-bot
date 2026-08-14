import logging
from typing import Optional
import httpx
from tenacity import retry, retry_if_exception, stop_after_attempt, wait_exponential

from app.features.shopify.infrastructure.clients.shopify_base_client import (
    ShopifyBaseClient,
    is_rate_limit_error,
)

logger = logging.getLogger(__name__)


class ShopifyInventoryClient(ShopifyBaseClient):
    """
    Cliente especializado para mutações e consultas de Estoque e Localização no Shopify.
    """

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception(is_rate_limit_error),
        reraise=True,
    )
    async def set_inventory_quantity(self, inventory_item_id: str, location_id: str, quantity: int) -> dict:
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
    async def get_primary_location_id(self) -> Optional[str]:
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
