import logging
from typing import Dict, List, Union, Any
import httpx
from tenacity import retry, retry_if_exception, stop_after_attempt, wait_exponential

from app.features.nuvemshop.infrastructure.nuvemshop_base_client import (
    NuvemshopBaseClient,
    is_rate_limit_error,
)
from app.features.nuvemshop.schemas import NuvemshopCategoryCreatePayload

logger = logging.getLogger(__name__)


class NuvemshopCategoryClient(NuvemshopBaseClient):
    """
    Cliente REST especializado na gestão de Categorias de Produtos da Nuvemshop.
    """

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception(is_rate_limit_error),
        reraise=True,
    )
    async def get_categories(self) -> List[Dict[str, Any]]:
        url = f"{self.base_url}/categories"
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(url, headers=self.headers)
                response.raise_for_status()
                res_data: List[Dict[str, Any]] = response.json()
                return res_data
            except httpx.HTTPStatusError as e:
                if e.response.status_code == 429:
                    retry_after = int(e.response.headers.get("Retry-After", 10))
                    from app.features.nuvemshop.services.nuvemshop_rate_limiter import NuvemshopRateLimiter
                    await NuvemshopRateLimiter.notify_rate_limit(self.store_id, retry_after)
                logger.error(f"Erro ao consultar categorias na Nuvemshop: {e.response.text}")
                raise e

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception(is_rate_limit_error),
        reraise=True,
    )
    async def create_category(
        self,
        payload: Union[NuvemshopCategoryCreatePayload, Dict[str, Any]],
    ) -> Dict[str, Any]:
        url = f"{self.base_url}/categories"
        if hasattr(payload, "model_dump"):
            data = payload.model_dump(exclude_none=True)
        elif isinstance(payload, dict):
            data = dict(payload)
        else:
            data = dict(payload)

        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(url, headers=self.headers, json=data)
                response.raise_for_status()
                res_data: Dict[str, Any] = response.json()
                logger.info(f"Categoria '{data.get('name')}' criada com sucesso na Nuvemshop (ID: {res_data.get('id')}).")
                return res_data
            except httpx.HTTPStatusError as e:
                if e.response.status_code == 429:
                    retry_after = int(e.response.headers.get("Retry-After", 10))
                    from app.features.nuvemshop.services.nuvemshop_rate_limiter import NuvemshopRateLimiter
                    await NuvemshopRateLimiter.notify_rate_limit(self.store_id, retry_after)
                elif e.response.status_code == 422:
                    logger.error(f"❌ Erro 422 ao criar categoria na Nuvemshop: {e.response.text}")
                else:
                    logger.error(f"Erro ao criar categoria na Nuvemshop: {e.response.text}")
                raise e
