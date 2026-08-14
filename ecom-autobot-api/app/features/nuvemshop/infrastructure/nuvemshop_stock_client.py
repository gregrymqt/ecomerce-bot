import logging
from typing import Dict, List, Optional, Any
import httpx
from tenacity import retry, retry_if_exception, stop_after_attempt, wait_exponential

from app.features.nuvemshop.infrastructure.nuvemshop_base_client import (
    NuvemshopBaseClient,
    is_rate_limit_error,
)
from app.features.nuvemshop.schemas import (
    NuvemshopLocationResponse,
    NuvemshopStockUpdateItem,
)

logger = logging.getLogger(__name__)


class NuvemshopStockClient(NuvemshopBaseClient):
    """
    Cliente REST especializado em gestão de Estoque e Localizações/Depósitos da Nuvemshop.
    """

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
    async def get_location_inventory_levels(
        self,
        location_id: str,
        variant_id: Optional[str] = None,
        page: int = 1,
        per_page: int = 10,
    ) -> Dict[str, Any]:
        """
        Consulta os saldos de estoque por localização/depósito via GET /v1/{store_id}/locations/{location_id}/inventory-levels.
        Suporta filtro por variant_id e paginação.
        """
        url = f"{self.base_url}/locations/{location_id}/inventory-levels"
        params: Dict[str, Any] = {
            "page": page,
            "per_page": per_page,
        }
        if variant_id:
            params["variant_id"] = variant_id

        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(url, headers=self.headers, params=params)
                response.raise_for_status()
                res_data = response.json()
                if isinstance(res_data, list):
                    return {
                        "total": len(res_data),
                        "page": page,
                        "per_page": per_page,
                        "results": res_data,
                    }
                elif isinstance(res_data, dict):
                    if "results" not in res_data:
                        res_data["results"] = res_data.get("data", [])
                    res_data.setdefault("total", len(res_data.get("results", [])))
                    res_data.setdefault("page", page)
                    res_data.setdefault("per_page", per_page)
                    return res_data
                return {"total": 0, "page": page, "per_page": per_page, "results": []}
            except httpx.HTTPStatusError as e:
                if e.response.status_code == 429:
                    logger.warning(f"Rate limit (429) atingido na Nuvemshop ao consultar estoque do depósito {location_id}. Acionando retry...")
                else:
                    logger.error(f"Erro ao consultar níveis de estoque na Nuvemshop [Status {e.response.status_code}]: {e.response.text}")
                raise e
            except Exception as e:
                logger.error(f"Falha de conexão ao consultar níveis de estoque na Nuvemshop: {str(e)}")
                raise e

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception(is_rate_limit_error),
        reraise=True,
    )
    async def _send_single_location_stock_batch(self, location_id: str, chunk: List[NuvemshopStockUpdateItem]) -> bool:
        url = f"{self.base_url}/locations/{location_id}/inventory-levels"
        payload = [item.model_dump(by_alias=True, exclude_none=True) for item in chunk]

        async with httpx.AsyncClient() as client:
            try:
                response = await client.patch(url, headers=self.headers, json=payload)
                if response.status_code not in (200, 201, 204):
                    response = await client.post(url, headers=self.headers, json=payload)
                response.raise_for_status()
                logger.info(f"Sub-lote de estoque ({len(chunk)} itens) atualizado com sucesso no depósito {location_id}.")
                return True
            except httpx.HTTPStatusError as e:
                if e.response.status_code == 429:
                    logger.warning(f"Rate limit (429) atingido na Nuvemshop ao atualizar estoque do depósito {location_id}. Acionando retry...")
                else:
                    logger.error(f"Erro ao atualizar estoque do depósito {location_id}: {e.response.text}")
                raise e

    async def update_location_stock(self, location_id: str, items: List[NuvemshopStockUpdateItem]) -> bool:
        """
        Atualiza em lote saldos de estoque por variante em determinado depósito com suporte a auto-chunking (pacotes de até 50 itens).
        """
        if not items:
            return True

        chunk_size = 50
        chunks = [items[i:i + chunk_size] for i in range(0, len(items), chunk_size)]

        for idx, chunk in enumerate(chunks):
            logger.info(f"Enviando sub-lote de estoque Nuvemshop {idx + 1}/{len(chunks)} ({len(chunk)} itens) para o depósito {location_id}...")
            await self._send_single_location_stock_batch(location_id, chunk)

        return True
