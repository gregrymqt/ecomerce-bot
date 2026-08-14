import logging
from typing import Dict, List, Optional, Union, Any
import httpx
from tenacity import retry, retry_if_exception, stop_after_attempt, wait_exponential

from app.features.nuvemshop.infrastructure.nuvemshop_base_client import (
    NuvemshopBaseClient,
    is_rate_limit_error,
)
from app.features.nuvemshop.schemas import (
    NuvemshopProductCreatePayload,
    NuvemshopProductRequest,
    NuvemshopProductUpdatePayload,
)

logger = logging.getLogger(__name__)


class NuvemshopProductClient(NuvemshopBaseClient):
    """
    Cliente REST especializado em operações CRUD de Produtos e Lotes de Estoque/Preço da Nuvemshop.
    """

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception(is_rate_limit_error),
        reraise=True,
    )
    async def create_product(
        self,
        product: Union[NuvemshopProductRequest, NuvemshopProductCreatePayload, Dict[str, Any]],
    ) -> Dict[str, Any]:
        """
        Cria um produto na Nuvemshop via POST /v1/{store_id}/products.
        """
        url = f"{self.base_url}/products"
        if hasattr(product, "model_dump"):
            payload = product.model_dump(by_alias=True, exclude_none=True)
        elif isinstance(product, dict):
            payload = dict(product)
        else:
            payload = dict(product)

        # REGRA CRÍTICA 2: NUNCA enviar 'published' e 'visibility' juntos!
        if "visibility" in payload and "published" in payload:
            payload.pop("published", None)

        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(url, headers=self.headers, json=payload)
                response.raise_for_status()
                res_data: Dict[str, Any] = response.json()
                logger.info(f"Produto criado com sucesso na Nuvemshop. ID: {res_data.get('id')}")
                return res_data
            except httpx.HTTPStatusError as e:
                if e.response.status_code == 429:
                    retry_after = int(e.response.headers.get("Retry-After", 10))
                    from app.features.nuvemshop.services.nuvemshop_rate_limiter import NuvemshopRateLimiter
                    await NuvemshopRateLimiter.notify_rate_limit(self.store_id, retry_after)
                    logger.warning(f"Rate limit (429) atingido na Nuvemshop ao criar produto. Lock 429 aplicado ({retry_after}s). Acionando retry...")
                else:
                    logger.error(f"Erro ao criar produto na Nuvemshop [Status {e.response.status_code}]: {e.response.text}")
                raise e

    async def get_product_by_id(self, product_id: int) -> Dict[str, Any]:
        url = f"{self.base_url}/products/{product_id}"
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(url, headers=self.headers)
                response.raise_for_status()
                res_data: Dict[str, Any] = response.json()
                return res_data
            except httpx.HTTPStatusError as e:
                if e.response.status_code == 429:
                    retry_after = int(e.response.headers.get("Retry-After", 10))
                    from app.features.nuvemshop.services.nuvemshop_rate_limiter import NuvemshopRateLimiter
                    await NuvemshopRateLimiter.notify_rate_limit(self.store_id, retry_after)
                logger.error(f"Erro ao buscar produto {product_id} na Nuvemshop: {e.response.text}")
                raise e

    async def get_product_by_sku(self, sku: str) -> Optional[Dict[str, Any]]:
        url = f"{self.base_url}/products/sku/{sku}"
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(url, headers=self.headers)
                if response.status_code == 404:
                    logger.warning(f"Produto com SKU {sku} não encontrado na Nuvemshop.")
                    return None
                response.raise_for_status()
                res_data: Dict[str, Any] = response.json()
                return res_data
            except httpx.HTTPStatusError as e:
                if e.response.status_code == 429:
                    retry_after = int(e.response.headers.get("Retry-After", 10))
                    from app.features.nuvemshop.services.nuvemshop_rate_limiter import NuvemshopRateLimiter
                    await NuvemshopRateLimiter.notify_rate_limit(self.store_id, retry_after)
                logger.error(f"Erro ao buscar SKU {sku} na Nuvemshop: {e.response.text}")
                raise e

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception(is_rate_limit_error),
        reraise=True,
    )
    async def update_product_metadata(
        self,
        product_id: int,
        update_data: Union[NuvemshopProductUpdatePayload, Dict[str, Any]],
    ) -> Dict[str, Any]:
        url = f"{self.base_url}/products/{product_id}"
        if hasattr(update_data, "model_dump"):
            payload = update_data.model_dump(by_alias=True, exclude_none=True)
        elif isinstance(update_data, dict):
            payload = dict(update_data)
        else:
            payload = dict(update_data)

        if "visibility" in payload and "published" in payload:
            payload.pop("published", None)

        async with httpx.AsyncClient() as client:
            try:
                response = await client.put(url, headers=self.headers, json=payload)
                response.raise_for_status()
                res_data: Dict[str, Any] = response.json()
                logger.info(f"Metadados do produto {product_id} atualizados com sucesso.")
                return res_data
            except httpx.HTTPStatusError as e:
                if e.response.status_code == 429:
                    retry_after = int(e.response.headers.get("Retry-After", 10))
                    from app.features.nuvemshop.services.nuvemshop_rate_limiter import NuvemshopRateLimiter
                    await NuvemshopRateLimiter.notify_rate_limit(self.store_id, retry_after)
                    logger.warning(f"Rate limit (429) atingido na Nuvemshop ao atualizar produto {product_id}. Lock 429 aplicado ({retry_after}s). Acionando retry...")
                else:
                    logger.error(f"Erro ao atualizar produto {product_id}: {e.response.text}")
                raise e

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception(is_rate_limit_error),
        reraise=True,
    )
    async def _send_single_stock_price_batch(self, chunk: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        url = f"{self.base_url}/products/stock-price"
        async with httpx.AsyncClient() as client:
            try:
                response = await client.patch(url, headers=self.headers, json=chunk)
                response.raise_for_status()
                logger.info(f"Sub-lote de preço/estoque ({len(chunk)} itens) processado na Nuvemshop.")
                res = response.json()
                return res if isinstance(res, list) else [res]
            except httpx.HTTPStatusError as e:
                if e.response.status_code == 429:
                    logger.warning("Rate limit (429) atingido na Nuvemshop no PATCH de sub-lote. Acionando retry...")
                else:
                    logger.error(f"Erro no PATCH de sub-lote da Nuvemshop: {e.response.text}")
                raise e

    async def update_stock_price_batch(self, batch_data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        if not batch_data:
            return []

        chunk_size = 50
        chunks = [batch_data[i:i + chunk_size] for i in range(0, len(batch_data), chunk_size)]

        all_results: List[Dict[str, Any]] = []
        for idx, chunk in enumerate(chunks):
            logger.info(f"Enviando sub-lote Nuvemshop {idx + 1}/{len(chunks)} com {len(chunk)} itens...")
            result_chunk = await self._send_single_stock_price_batch(chunk)
            all_results.extend(result_chunk)

        return all_results

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception(is_rate_limit_error),
        reraise=True,
    )
    async def delete_product(self, product_id: int) -> bool:
        url = f"{self.base_url}/products/{product_id}"
        async with httpx.AsyncClient() as client:
            try:
                response = await client.delete(url, headers=self.headers)
                response.raise_for_status()
                logger.info(f"Produto {product_id} removido com sucesso da Nuvemshop.")
                return True
            except httpx.HTTPStatusError as e:
                if e.response.status_code == 429:
                    logger.warning(f"Rate limit (429) atingido na Nuvemshop ao remover produto {product_id}. Acionando retry...")
                else:
                    logger.error(f"Erro ao deletar produto {product_id}: {e.response.text}")
                raise e
