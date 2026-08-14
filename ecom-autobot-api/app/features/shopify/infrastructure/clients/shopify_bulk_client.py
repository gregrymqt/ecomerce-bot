import logging
from typing import List
import httpx
from tenacity import retry, retry_if_exception, stop_after_attempt, wait_exponential

from app.features.shopify.infrastructure.clients.shopify_base_client import (
    ShopifyBaseClient,
    is_rate_limit_error,
)

logger = logging.getLogger(__name__)


class ShopifyBulkClient(ShopifyBaseClient):
    """
    Cliente especializado para a Bulk API do Shopify (Staged Uploads, Bulk Mutations e Status Check).
    """

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception(is_rate_limit_error),
        reraise=True,
    )
    async def create_staged_upload(self, input_data: List[dict]) -> dict:
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
