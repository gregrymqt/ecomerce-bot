import logging
from typing import List, Optional
import httpx
from tenacity import retry, retry_if_exception, stop_after_attempt, wait_exponential

from app.features.nuvemshop.schemas import NuvemshopProductRequest, NuvemshopLocationResponse

logger = logging.getLogger(__name__)


def is_rate_limit_error(exception: Exception) -> bool:
    return isinstance(exception, httpx.HTTPStatusError) and exception.response.status_code == 429


class NuvemshopClient:
    """
    Cliente de infraestrutura HTTP/REST desacoplado para a API da Nuvemshop (Tiendanube).
    """

    def __init__(self, store_id: str, access_token: str, app_email: str = "suporte@gregcompany.com"):
        self.store_id = store_id
        self.access_token = access_token
        self.base_url = f"https://api.nuvemshop.com.br/v1/{self.store_id}"

        self.headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json",
            "User-Agent": f"EcommerceBotGreg ({app_email})",
        }

    async def validate_scopes(self, required_scope: str = "write_products") -> bool:
        url = f"{self.base_url}/store"
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(url, headers=self.headers)
                if response.status_code in (401, 403):
                    return False
                response.raise_for_status()

                scopes_header = response.headers.get("X-Tiendanube-Scopes", response.headers.get("X-Supported-Scopes", ""))
                if not scopes_header:
                    logger.warning(f"Headers de escopo não encontrados na resposta para a loja {self.store_id}.")
                    return False

                return required_scope in scopes_header
            except httpx.HTTPStatusError as e:
                logger.error(f"Erro ao tentar validar escopos na Nuvemshop [Status {e.response.status_code}]: {e.response.text}")
                return False
            except Exception as e:
                logger.error(f"Falha de conexão ao validar escopos na Nuvemshop: {str(e)}")
                return False

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception(is_rate_limit_error),
        reraise=True,
    )
    async def get_locations(self) -> List[NuvemshopLocationResponse]:
        """
        Recupera a lista de depósitos / localizações de estoque da loja na Nuvemshop.
        Realiza GET /v1/{store_id}/locations com retry automático em caso de rate limit (429).
        """
        url = f"{self.base_url}/locations"
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(url, headers=self.headers)
                response.raise_for_status()
                locations_raw = response.json()
                if isinstance(locations_raw, list):
                    return [NuvemshopLocationResponse.model_validate(loc) for loc in locations_raw]
                elif isinstance(locations_raw, dict):
                    return [NuvemshopLocationResponse.model_validate(locations_raw)]
                return []
            except httpx.HTTPStatusError as e:
                if e.response.status_code == 429:
                    logger.warning("Rate limit (429) atingido na Nuvemshop ao buscar locations. Acionando retry...")
                else:
                    logger.error(f"Erro ao buscar depósitos na Nuvemshop [Status {e.response.status_code}]: {e.response.text}")
                raise e
            except Exception as e:
                logger.error(f"Falha de conexão ao buscar depósitos na Nuvemshop: {str(e)}")
                raise e

    async def get_default_location(self) -> Optional[NuvemshopLocationResponse]:
        """
        Retorna a localização/depósito configurado como padrão (is_default == True).
        """
        locations = await self.get_locations()
        for loc in locations:
            if loc.is_default:
                return loc
        return locations[0] if locations else None

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception(is_rate_limit_error),
        reraise=True,
    )
    async def create_product(self, product: NuvemshopProductRequest) -> dict:
        url = f"{self.base_url}/products"
        payload = product.model_dump(by_alias=True, exclude_none=True)

        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(url, headers=self.headers, json=payload)
                response.raise_for_status()
                logger.info(f"Produto criado com sucesso na Nuvemshop. ID: {response.json().get('id')}")
                return response.json()
            except httpx.HTTPStatusError as e:
                if e.response.status_code == 429:
                    logger.warning("Rate limit (429) atingido na Nuvemshop ao criar produto. Acionando retry...")
                else:
                    logger.error(f"Erro ao criar produto na Nuvemshop [Status {e.response.status_code}]: {e.response.text}")
                raise e

    async def get_product_by_id(self, product_id: int) -> dict:
        url = f"{self.base_url}/products/{product_id}"
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(url, headers=self.headers)
                response.raise_for_status()
                return response.json()
            except httpx.HTTPStatusError as e:
                logger.error(f"Erro ao buscar produto {product_id} na Nuvemshop: {e.response.text}")
                raise e

    async def get_product_by_sku(self, sku: str) -> Optional[dict]:
        url = f"{self.base_url}/products/sku/{sku}"
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(url, headers=self.headers)
                if response.status_code == 404:
                    logger.warning(f"Produto com SKU {sku} não encontrado na Nuvemshop.")
                    return None
                response.raise_for_status()
                return response.json()
            except httpx.HTTPStatusError as e:
                logger.error(f"Erro ao buscar SKU {sku} na Nuvemshop: {e.response.text}")
                raise e

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception(is_rate_limit_error),
        reraise=True,
    )
    async def update_product_metadata(self, product_id: int, update_data: dict) -> dict:
        url = f"{self.base_url}/products/{product_id}"
        async with httpx.AsyncClient() as client:
            try:
                response = await client.put(url, headers=self.headers, json=update_data)
                response.raise_for_status()
                logger.info(f"Metadados do produto {product_id} atualizados com sucesso.")
                return response.json()
            except httpx.HTTPStatusError as e:
                if e.response.status_code == 429:
                    logger.warning(f"Rate limit (429) atingido na Nuvemshop ao atualizar produto {product_id}. Acionando retry...")
                else:
                    logger.error(f"Erro ao atualizar produto {product_id}: {e.response.text}")
                raise e

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception(is_rate_limit_error),
        reraise=True,
    )
    async def _send_single_stock_price_batch(self, chunk: List[dict]) -> List[dict]:
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

    async def update_stock_price_batch(self, batch_data: List[dict]) -> List[dict]:
        """
        Atualiza em lote preço/estoque na Nuvemshop com particionamento automático (auto-chunking).
        Subdivide listas superiores a 50 elementos em pacotes de até 50 itens e executa com retries.
        """
        if not batch_data:
            return []

        chunk_size = 50
        chunks = [batch_data[i:i + chunk_size] for i in range(0, len(batch_data), chunk_size)]

        all_results = []
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
