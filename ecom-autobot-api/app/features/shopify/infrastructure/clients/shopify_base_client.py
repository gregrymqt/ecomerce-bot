import logging
import httpx
from tenacity import retry, retry_if_exception, stop_after_attempt, wait_exponential

from app.core.config.settings import settings

logger = logging.getLogger(__name__)


class ShopifyRateLimitError(Exception):
    """Exceção customizada para rate limits da API Shopify (HTTP 429 ou GraphQL Cost Throttling em 200 OK)."""
    pass


def is_rate_limit_error(exception: Exception) -> bool:
    if isinstance(exception, ShopifyRateLimitError):
        return True
    return isinstance(exception, httpx.HTTPStatusError) and exception.response.status_code == 429


class ShopifyBaseClient:
    """
    Cliente base de infraestrutura HTTP/GraphQL para a Admin API do Shopify.
    Encapsula credenciais, montagem de URL base e tratamento de erros de throttling GraphQL.
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
