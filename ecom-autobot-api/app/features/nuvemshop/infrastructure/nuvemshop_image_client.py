import logging
from typing import Dict, List, Union, Any
import httpx
from tenacity import retry, retry_if_exception, stop_after_attempt, wait_exponential

from app.features.nuvemshop.infrastructure.nuvemshop_base_client import (
    NuvemshopBaseClient,
    is_rate_limit_error,
)
from app.features.nuvemshop.schemas import (
    NuvemshopImageUpdatePayload,
    NuvemshopImageUploadPayload,
)

logger = logging.getLogger(__name__)


class NuvemshopImageClient(NuvemshopBaseClient):
    """
    Cliente REST especializado na gestão de Galeria de Imagens/Mídia da Nuvemshop.
    """

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception(is_rate_limit_error),
        reraise=True,
    )
    async def get_product_images(self, product_id: int) -> List[Dict[str, Any]]:
        url = f"{self.base_url}/products/{product_id}/images"
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
                logger.error(f"Erro ao listar imagens do produto {product_id} na Nuvemshop: {e.response.text}")
                raise e

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception(is_rate_limit_error),
        reraise=True,
    )
    async def upload_product_image(
        self,
        product_id: int,
        payload: Union[NuvemshopImageUploadPayload, Dict[str, Any]],
    ) -> Dict[str, Any]:
        url = f"{self.base_url}/products/{product_id}/images"
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
                logger.info(f"Imagem enviada com sucesso para o produto {product_id} na Nuvemshop (ID: {res_data.get('id')}).")
                return res_data
            except httpx.HTTPStatusError as e:
                if e.response.status_code == 429:
                    retry_after = int(e.response.headers.get("Retry-After", 10))
                    from app.features.nuvemshop.services.nuvemshop_rate_limiter import NuvemshopRateLimiter
                    await NuvemshopRateLimiter.notify_rate_limit(self.store_id, retry_after)
                elif e.response.status_code == 422:
                    logger.error(
                        f"❌ Erro 422 (Unprocessable Entity) na Nuvemshop ao enviar imagem para produto {product_id} "
                        f"(Limite de 250 imagens excedido ou formato inválido): {e.response.text}"
                    )
                else:
                    logger.error(f"Erro no POST de imagem do produto {product_id}: {e.response.text}")
                raise e

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception(is_rate_limit_error),
        reraise=True,
    )
    async def update_product_image(
        self,
        product_id: int,
        image_id: int,
        payload: Union[NuvemshopImageUpdatePayload, Dict[str, Any]],
    ) -> Dict[str, Any]:
        url = f"{self.base_url}/products/{product_id}/images/{image_id}"
        if hasattr(payload, "model_dump"):
            data = payload.model_dump(exclude_none=True)
        elif isinstance(payload, dict):
            data = dict(payload)
        else:
            data = dict(payload)

        async with httpx.AsyncClient() as client:
            try:
                response = await client.put(url, headers=self.headers, json=data)
                response.raise_for_status()
                res_data: Dict[str, Any] = response.json()
                logger.info(f"Imagem {image_id} do produto {product_id} atualizada com sucesso na Nuvemshop.")
                return res_data
            except httpx.HTTPStatusError as e:
                if e.response.status_code == 429:
                    retry_after = int(e.response.headers.get("Retry-After", 10))
                    from app.features.nuvemshop.services.nuvemshop_rate_limiter import NuvemshopRateLimiter
                    await NuvemshopRateLimiter.notify_rate_limit(self.store_id, retry_after)
                logger.error(f"Erro no PUT de imagem {image_id} do produto {product_id}: {e.response.text}")
                raise e

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception(is_rate_limit_error),
        reraise=True,
    )
    async def delete_product_image(self, product_id: int, image_id: int) -> bool:
        url = f"{self.base_url}/products/{product_id}/images/{image_id}"
        async with httpx.AsyncClient() as client:
            try:
                response = await client.delete(url, headers=self.headers)
                response.raise_for_status()
                logger.info(f"Imagem {image_id} do produto {product_id} removida com sucesso da Nuvemshop.")
                return True
            except httpx.HTTPStatusError as e:
                if e.response.status_code == 429:
                    retry_after = int(e.response.headers.get("Retry-After", 10))
                    from app.features.nuvemshop.services.nuvemshop_rate_limiter import NuvemshopRateLimiter
                    await NuvemshopRateLimiter.notify_rate_limit(self.store_id, retry_after)
                logger.error(f"Erro ao remover imagem {image_id} do produto {product_id}: {e.response.text}")
                raise e
